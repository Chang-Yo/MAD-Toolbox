import { Modal, ScrollArea, Text } from "@mantine/core";

interface MediaInspectionDialogProps {
  active: boolean;
  summary: string | null;
  onClose: () => void;
}

export function MediaInspectionDialog({ active, summary, onClose }: MediaInspectionDialogProps) {
  return (
    <Modal opened={active && summary !== null} onClose={onClose} title="媒体信息" size="lg">
      <ScrollArea h={360}>
        <Text size="xs" component="pre" style={{ whiteSpace: "pre-wrap" }}>
          {summary}
        </Text>
      </ScrollArea>
    </Modal>
  );
}
