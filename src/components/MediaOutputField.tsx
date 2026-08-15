import { TextInput, Tooltip } from "@mantine/core";
import { IconFolderOpen } from "@tabler/icons-react";

interface MediaOutputFieldProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onBrowse: () => Promise<void>;
}

export function MediaOutputField({ value, disabled, onChange, onBrowse }: MediaOutputFieldProps) {
  return (
    <TextInput
      label="输出目录"
      placeholder="留空则输出到源文件目录"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      disabled={disabled}
      leftSection={
        <Tooltip label="选择目录">
          <IconFolderOpen size={16} style={{ cursor: "pointer" }} onClick={() => void onBrowse()} />
        </Tooltip>
      }
    />
  );
}
