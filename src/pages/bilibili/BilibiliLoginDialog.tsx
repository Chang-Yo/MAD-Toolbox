import { Modal, Stack, Text } from "@mantine/core";

interface BilibiliLoginDialogProps {
  active: boolean;
  qrDataUrl: string | null;
  onClose: () => void;
}

export function BilibiliLoginDialog({ active, qrDataUrl, onClose }: BilibiliLoginDialogProps) {
  return (
    <Modal
      opened={active && qrDataUrl !== null}
      onClose={onClose}
      title="扫码登录哔哩哔哩"
      centered
    >
      <Stack align="center" gap="sm">
        {qrDataUrl && <img src={qrDataUrl} alt="登录二维码" width={280} height={280} />}
        <Text size="sm" c="dimmed">
          使用哔哩哔哩手机客户端扫码并确认
        </Text>
      </Stack>
    </Modal>
  );
}
