import { Badge, Stack, Text } from "@mantine/core";
import { CollapsibleSection } from "../../components/CollapsibleSection";
import { NetworkVideoAdvancedFields } from "../../components/NetworkVideoAdvancedFields";
import { NetworkVideoCommandPanel } from "../../components/NetworkVideoCommandPanel";
import { NetworkVideoDownloadFields } from "../../components/NetworkVideoDownloadFields";
import { NetworkVideoPageHeader } from "../../components/NetworkVideoPageHeader";
import { NetworkVideoProbeDialog } from "../../components/NetworkVideoProbeDialog";
import {
  useNetworkVideoWorkspace,
  type NetworkVideoPageProps
} from "../../hooks/useNetworkVideoWorkspace";

export function NetworkVideoPage(props: NetworkVideoPageProps) {
  const workspace = useNetworkVideoWorkspace(props);

  return (
    <Stack gap="md" p="md">
      <NetworkVideoPageHeader
        probing={workspace.probing}
        probeDisabled={!workspace.form.url.trim() || workspace.expertMode}
        submitting={workspace.submitting}
        submitDisabled={!workspace.expertMode && !workspace.preview}
        onSubmit={() => void workspace.submit()}
        onProbe={workspace.probe}
      />

      <Stack gap="sm">
        <NetworkVideoDownloadFields
          form={workspace.form}
          disabled={workspace.expertMode}
          onUpdate={workspace.update}
          onPickOutputDirectory={workspace.pickOutputDirectory}
        />
      </Stack>

      <CollapsibleSection
        title={
          <>
            <Text size="sm" fw={500}>
              高级参数
            </Text>
            {workspace.expertMode && (
              <Badge size="xs" variant="light" color="orange">
                专家模式
              </Badge>
            )}
          </>
        }
        opened={workspace.advancedOpen}
        onToggle={workspace.toggleAdvanced}
      >
        <Stack gap="sm">
          <NetworkVideoCommandPanel
            expertText={workspace.expertText}
            preview={workspace.preview}
            previewError={workspace.previewError}
            onEnterExpert={workspace.enterExpert}
            onExitExpert={() => workspace.setExpertText(null)}
            onExpertTextChange={workspace.setExpertText}
            withDivider
          />
          <NetworkVideoAdvancedFields
            form={workspace.form}
            disabled={workspace.expertMode}
            onUpdate={workspace.update}
          />
        </Stack>
      </CollapsibleSection>

      <NetworkVideoProbeDialog
        active={workspace.active}
        result={workspace.probeResult}
        onClose={() => workspace.setProbeResult(null)}
      />
    </Stack>
  );
}
