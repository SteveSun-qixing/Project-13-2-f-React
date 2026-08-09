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
        <div>
          <h2>{t("profile.collectionTitle")}</h2>
        </div>

        {isOwner ? (
          <div className="works-section__actions">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              aria-label={t("profile.openWorkspace")}
              onClick={() => navigate("/workspace")}
            />
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
        <div className="panel works-section__manage-bar">
          <div className="works-section__manage-copy">
            <strong>{t("profile.manageTitle")}</strong>
            <p className="muted">{t("profile.manageHint")}</p>
            {manageError ? <div className="inline-notice inline-notice--danger">{manageError}</div> : null}
          </div>

          <div className="works-section__manage-actions">
            <span className="works-section__manage-count">
              {t("profile.manageSelectedCount", { count: selectedWorkKeys.size })}
            </span>
            <Button
              type="default"
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
