import React from "react";
import { ChipsCardShell } from "@chips/component-library";
import { useI18n } from "../../app/providers/I18nProvider";
import { CardGridItem, PageStack, ShowcaseCardGrid } from "../../shared/ui/PageLayout";
import { PageFrame } from "../../shared/ui/PageFrame";
import { getComponentGroups } from "./registry";

export function ComponentGalleryPage(): React.ReactElement {
  const { t } = useI18n();
  const items = React.useMemo(() => getComponentGroups().flatMap((group) => group.items), []);

  return (
    <PageFrame title={t("settingsPanel.gallery.title")}>
      <PageStack>
        <ShowcaseCardGrid>
          {items.map((item) => {
            const Preview = item.preview;
            return (
              <CardGridItem key={`${item.scope}:${item.name}`} emphasis={item.emphasis}>
                <ChipsCardShell title={item.name}>
                  <Preview />
                </ChipsCardShell>
              </CardGridItem>
            );
          })}
        </ShowcaseCardGrid>
      </PageStack>
    </PageFrame>
  );
}
