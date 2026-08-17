import { TextInput, Tooltip } from "@mantine/core";
import { IconFolderOpen } from "@tabler/icons-react";

interface OutputDirectoryFieldProps {
  value: string;
  disabled: boolean;
  /** 各工具的留空回退目录不同，占位文案由调用方给出 */
  placeholder?: string;
  onChange: (value: string) => void;
  onBrowse: () => Promise<void>;
}

export function OutputDirectoryField({
  value,
  disabled,
  placeholder,
  onChange,
  onBrowse
}: OutputDirectoryFieldProps) {
  return (
    <TextInput
      label="输出目录"
      description="默认保存到系统「下载」目录下的 MADToolbox 文件夹"
      placeholder={placeholder}
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
