import { Badge, Stack, Text } from "@mantine/core";
import { BilibiliAdvancedFields } from "../../components/BilibiliAdvancedFields";
import { BilibiliCommandPanel } from "../../components/BilibiliCommandPanel";
import { BilibiliDownloadFields } from "../../components/BilibiliDownloadFields";
import { BilibiliLoginDialog } from "../../components/BilibiliLoginDialog";
import { BilibiliPageHeader } from "../../components/BilibiliPageHeader";
import { CollapsibleSection } from "../../components/CollapsibleSection";
import { useBilibiliWorkspace, type BilibiliPageProps } from "../../hooks/useBilibiliWorkspace";

export function BilibiliPage(props: BilibiliPageProps) {
  const workspace = useBilibiliWorkspace(props);

  return (
    <Stack gap="md" p="md">
      <BilibiliPageHeader
        active={workspace.active}
        loginPhase={workspace.loginPhase}
        submitting={workspace.submitting}
        submitDisabled={!workspace.expertMode && !workspace.preview}
        onSubmit={() => void workspace.submit()}
        templateMenuOpened={workspace.templateMenuOpened}
        templates={workspace.templates}
        onTemplateMenuChange={workspace.setTemplateMenuOpened}
        onBeginLogin={workspace.beginLogin}
        onSaveTemplate={workspace.saveAsTemplate}
        onApplyTemplate={workspace.applyTemplate}
      />

      <Stack gap="sm">
        <BilibiliDownloadFields
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
          <BilibiliCommandPanel
            expertText={workspace.expertText}
            preview={workspace.preview}
            previewError={workspace.previewError}
            onEnterExpert={workspace.enterExpert}
            onExitExpert={() => workspace.setExpertText(null)}
            onExpertTextChange={workspace.setExpertText}
            withDivider
          />
          <BilibiliAdvancedFields
            form={workspace.form}
            disabled={workspace.expertMode}
            onUpdate={workspace.update}
          />
        </Stack>
      </CollapsibleSection>

      <BilibiliLoginDialog
        active={workspace.active}
        qrDataUrl={workspace.loginQr}
        onClose={workspace.dismissLoginQr}
      />
    </Stack>
  );
}
