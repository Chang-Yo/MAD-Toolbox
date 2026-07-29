#!/usr/bin/env python3
"""Bridge an externally installed musicdl package to MAD Toolbox.

This file contains no musicdl source code. It only calls musicdl's documented
public Python API so search results can be selected in the app GUI.
"""

import json
import os
import pickle
import shutil
import sys

from musicdl import musicdl


LOSSLESS_EXTENSIONS = {"flac", "wav", "alac", "ape", "wv", "tta", "dsf", "dff"}


def build_client(request, work_dir_override=None):
    sources = request.get("musicSources") or []
    init_cfg = request.get("initMusicClientsCfg") or {}
    output_directory = work_dir_override or request.get("outputDirectory")
    search_size = max(1, min(int(request.get("searchSizePerSource") or 5), 100))
    for source in sources:
        source_cfg = init_cfg.setdefault(source, {})
        source_cfg.setdefault("search_size_per_source", search_size)
        if output_directory:
            source_cfg["work_dir"] = output_directory
    return musicdl.MusicClient(
        music_sources=sources,
        init_music_clients_cfg=init_cfg,
        clients_threadings=request.get("clientsThreadings") or {},
        requests_overrides=request.get("requestsOverrides") or {},
        search_rules=request.get("searchRules") or {},
    )


def integer_or_none(value):
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def display_result(index, song):
    extension = str(song.ext or "").removeprefix(".").lower()
    cover_url = song.cover_url if isinstance(song.cover_url, str) else None
    return {
        "index": index,
        "songName": str(song.song_name or "未知曲名"),
        "singers": str(song.singers or "未知歌手"),
        "album": str(song.album or ""),
        "extension": extension,
        "fileSize": str(song.file_size or ""),
        "duration": str(song.duration or ""),
        "bitrate": integer_or_none(song.bitrate),
        "codec": str(song.codec or ""),
        "sampleRate": integer_or_none(song.samplerate),
        "channels": integer_or_none(song.channels),
        "source": str(song.source or ""),
        "rootSource": str(song.root_source or ""),
        "coverUrl": cover_url,
        "lossless": extension in LOSSLESS_EXTENSIONS,
    }


def download_flat(client, songs, output_directory):
    if not output_directory:
        raise RuntimeError("Missing music output directory.")
    os.makedirs(output_directory, exist_ok=True)
    for song in songs:
        song.work_dir = output_directory
        song._save_path = None
    downloaded = client.download(song_infos=songs)
    if not downloaded:
        raise RuntimeError("musicdl did not download any music.")
    metadata_path = os.path.join(output_directory, "download_results.pkl")
    if os.path.isfile(metadata_path):
        os.remove(metadata_path)
    return downloaded


def search(request_path, state_path):
    with open(request_path, "r", encoding="utf-8") as handle:
        request = json.load(handle)
    staging_directory = os.path.join(os.path.dirname(state_path), "staging")
    os.makedirs(staging_directory, mode=0o700, exist_ok=True)
    client = build_client(request, staging_directory)
    grouped_results = client.search(keyword=request["keyword"])
    songs = []
    for per_source_results in grouped_results.values():
        for song in per_source_results:
            if song.episodes:
                songs.extend(song.episodes)
            else:
                songs.append(song)
    with open(state_path, "wb") as handle:
        pickle.dump({"request": request, "songs": songs}, handle)
    os.chmod(state_path, 0o600)
    shutil.rmtree(staging_directory, ignore_errors=True)
    results = [display_result(index, song) for index, song in enumerate(songs)]
    print(json.dumps({"results": results}, ensure_ascii=False, separators=(",", ":")))


def download(state_path, selected_json):
    with open(state_path, "rb") as handle:
        state = pickle.load(handle)
    selected_indices = json.loads(selected_json)
    songs = state["songs"]
    selected = [songs[index] for index in selected_indices if 0 <= index < len(songs)]
    if not selected:
        raise RuntimeError("No valid music items were selected.")
    output_directory = state["request"].get("outputDirectory")
    client = build_client(state["request"], os.path.join(os.path.dirname(state_path), "staging"))
    downloaded = download_flat(client, selected, output_directory)
    shutil.rmtree(os.path.join(os.path.dirname(state_path), "staging"), ignore_errors=True)
    print(
        f"musicdl completed: {len(downloaded)} item(s) exported directly to "
        f"{output_directory}."
    )


def playlist(request_path):
    with open(request_path, "r", encoding="utf-8") as handle:
        request = json.load(handle)
    session_directory = os.path.dirname(request_path)
    staging_directory = os.path.join(session_directory, "staging")
    os.makedirs(staging_directory, mode=0o700, exist_ok=True)
    client = build_client(request, staging_directory)
    songs = client.parseplaylist(request["playlistUrl"])
    if not songs:
        raise RuntimeError("musicdl could not parse any music from this playlist.")
    downloaded = download_flat(client, songs, request.get("outputDirectory"))
    shutil.rmtree(staging_directory, ignore_errors=True)
    print(
        f"musicdl completed: {len(downloaded)} playlist item(s) exported directly "
        f"to {request['outputDirectory']}."
    )


def main():
    if len(sys.argv) < 2:
        raise RuntimeError("Missing adapter operation.")
    if sys.argv[1] == "search" and len(sys.argv) == 4:
        search(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == "download" and len(sys.argv) == 4:
        download(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == "playlist" and len(sys.argv) == 3:
        playlist(sys.argv[2])
    else:
        raise RuntimeError("Invalid adapter arguments.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
