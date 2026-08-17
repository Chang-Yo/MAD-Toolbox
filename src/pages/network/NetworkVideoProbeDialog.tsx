import { Modal, ScrollArea, Text } from "@mantine/core";
import type { NetworkProbeResult } from "./useNetworkVideoWorkspace";

interface NetworkVideoProbeDialogProps {
  active: boolean;
  result: NetworkProbeResult | null;
  onClose: () => void;
}

export function NetworkVideoProbeDialog({ active, result, onClose }: NetworkVideoProbeDialogProps) {
  return (
    <Modal opened={active && result !== null} onClose={onClose} title={result?.title} size="xl">
      <ScrollArea h={420}>
        <Text
          size="xs"
          component="pre"
          style={{ fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all" }}
        >
          {result?.text}
        </Text>
      </ScrollArea>
    </Modal>
  );
}
