import { useNavigate } from "react-router-dom";
import { Button, Empty } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useAppPreferences } from "../contexts/PreferencesContext";
import { getCommunityWorkSelectionKey, type CommunityWorkItem } from "../types/community";
import { WorkTile } from "./WorkTile";

interface WorkGridProps {
  items: CommunityWorkItem[];
  isOwner: boolean;
  manageMode: boolean;
  selectedWorkKeys: ReadonlySet<string>;
  manageError: string;
  isDeleting: boolean;
  onToggleManageMode: () => void;
  onToggleWorkSelection: (item: CommunityWorkItem) => void;
  onDeleteSelectedWorks: () => void;
}

export function WorkGrid({
  items,
  isOwner,
  manageMode,
  selectedWorkKeys,
  manageError,
  isDeleting,
  onToggleManageMode,
  onToggleWorkSelection,
  onDeleteSelectedWorks,
}: WorkGridProps) {
  const { t } = useAppPreferences();
  const navigate = useNavigate();
  const workCount = items.length;

  return (
    <section className="works-section">
      <div className="works-section__header">
        <h2 className="works-section__title">{t("profile.collectionTitle")}</h2>

        {isOwner ? (
          <div className="works-section__actions">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/workspace")}>
              {t("profile.uploadWork")}
            </Button>
            <Button
              type={manageMode ? "primary" : "default"}
              onClick={onToggleManageMode}
              disabled={isDeleting || workCount === 0}
            >
              {manageMode ? t("profile.manageDone") : t("profile.manageAction")}
            </Button>
          </div>
        ) : null}
      </div>

      {isOwner && manageMode ? (
        <div className="works-section__manage-bar">
          <span className="works-section__manage-count">
            {t("profile.manageSelectedCount", { count: selectedWorkKeys.size })}
          </span>
          <div className="works-section__manage-actions">
            {manageError ? <div className="inline-notice inline-notice--danger">{manageError}</div> : null}
            <Button type="default" onClick={onToggleManageMode} disabled={isDeleting}>
              {t("common.cancel")}
            </Button>
            <Button
              type="primary"
              danger
              onClick={onDeleteSelectedWorks}
              loading={isDeleting}
              disabled={selectedWorkKeys.size === 0}
            >
              {isDeleting ? t("profile.manageDeleting") : t("profile.manageDelete")}
            </Button>
          </div>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="work-grid">
          {items.map((item) => (
            <WorkTile
              key={`${item.type}-${item.id}`}
              item={item}
              manageMode={manageMode}
              selected={selectedWorkKeys.has(getCommunityWorkSelectionKey(item))}
              onToggleSelection={onToggleWorkSelection}
            />
          ))}
        </div>
      ) : (
        <div className="works-section__empty">
          <Empty description={t("profile.empty")} />
        </div>
      )}
    </section>
  );
}
