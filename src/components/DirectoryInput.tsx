import { FolderOpen } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { TextInput } from "./Field";
import { fileManagerName } from "../lib/platform";

interface DirectoryInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function DirectoryInput({ value, onChange, placeholder }: DirectoryInputProps) {
  const choose = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") onChange(selected);
  };

  return (
    <div className="input-with-button">
      <TextInput
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      <button
        className="icon-button"
        type="button"
        title={`在${fileManagerName}中选择`}
        onClick={() => void choose()}
      >
        <FolderOpen size={16} />
      </button>
    </div>
  );
}
