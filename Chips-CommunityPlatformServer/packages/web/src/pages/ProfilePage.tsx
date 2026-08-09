import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from 'antd';
import { authApi, type PublicUserProfile } from '../api/auth';
import { boxesApi, cardsApi, type BoxSummary, type CardSummary } from '../api/content';
import { ProfileHero } from '../components/ProfileHero';
import { ProfileSettingsDialog, type ProfileSettingsPayload } from '../components/ProfileSettingsDialog';
import { WorkGrid } from '../components/WorkGrid';
import { useAuth } from '../contexts/AuthContext';
import { getErrorMessage } from '../lib/ui';
import { getCommunityWorkSelectionKey, type CommunityWorkItem } from '../types/community';
import './ProfilePage.css';

interface ProfileState {
  user: PublicUserProfile | null;
  items: CommunityWorkItem[];
  loading: boolean;
  error: string;
}

function toCommunityWorks(cards: CardSummary[], boxes: BoxSummary[]): CommunityWorkItem[] {
  const cardItems = cards
    .filter((card) => card.visibility === 'public' && card.status === 'ready')
    .map<CommunityWorkItem>((card) => ({
      id: card.id,
      type: 'card',
      title: card.title,
      coverUrl: card.coverUrl,
      coverRatio: card.coverRatio,
      href: `/cards/${card.id}`,
      createdAt: card.createdAt,
    }));

  const boxItems = boxes
    .filter((box) => box.visibility === 'public')
    .map<CommunityWorkItem>((box) => ({
      id: box.id,
      type: 'box',
      title: box.title,
      coverUrl: box.coverUrl,
      coverRatio: box.coverRatio,
      href: `/boxes/${box.id}`,
      createdAt: box.createdAt,
    }));

  return [...cardItems, ...boxItems].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

function toPublicProfile(user: {
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
}): PublicUserProfile {
  return {
    username: user.username,
    displayName: user.displayName || user.username,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

export default function ProfilePage() {
  const { username: rawUsername } = useParams<{ username: string }>();
  const { user: authUser, isLoading: isAuthLoading, logout, refreshUser } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [manageMode, setManageMode] = useState(false);
  const [selectedWorkKeys, setSelectedWorkKeys] = useState<string[]>([]);
  const [manageError, setManageError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [state, setState] = useState<ProfileState>({
    user: null,
    items: [],
    loading: true,
    error: '',
  });

  const username = useMemo(() => {
    if (!rawUsername) {
      return undefined;
    }

    return rawUsername.startsWith('@') ? rawUsername.slice(1) : rawUsername;
  }, [rawUsername]);

  useEffect(() => {
    if (!username) {
      setState({
        user: null,
        items: [],
        loading: false,
        error: '没有找到这个用户。',
      });
      return;
    }

    let active = true;

    setState((current) => ({
      ...current,
      loading: true,
      error: '',
    }));

    void Promise.all([
      authApi.getUserProfile(username),
      cardsApi.getAllUserCards(username),
      boxesApi.getAllUserBoxes(username),
    ])
      .then(([profile, cards, boxes]) => {
        if (!active) {
          return;
        }

        setState({
          user: profile,
          items: toCommunityWorks(cards, boxes),
          loading: false,
          error: '',
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setState({
          user: null,
          items: [],
          loading: false,
          error: getErrorMessage(error, '没有找到这个用户。'),
        });
      });

    return () => {
      active = false;
    };
  }, [reloadKey, username]);

  const isOwner = useMemo(() => {
    if (isAuthLoading || !authUser || !state.user) {
      return false;
    }

    return authUser.username.toLowerCase() === state.user.username.toLowerCase();
  }, [authUser, isAuthLoading, state.user]);
  const isProfilePending = state.loading || isAuthLoading;

  const selectedWorkKeySet = useMemo(() => new Set(selectedWorkKeys), [selectedWorkKeys]);

  useEffect(() => {
    setManageMode(false);
    setSelectedWorkKeys([]);
    setManageError('');
    setIsDeleting(false);
    setIsProfileSettingsOpen(false);
  }, [username]);

  useEffect(() => {
    if (!isOwner) {
      setIsProfileSettingsOpen(false);
    }
  }, [isOwner]);

  const handleToggleManageMode = () => {
    if (isDeleting) {
      return;
    }

    setManageMode((current) => !current);
    setSelectedWorkKeys([]);
    setManageError('');
  };

  const handleToggleWorkSelection = (item: CommunityWorkItem) => {
    if (!manageMode || isDeleting) {
      return;
    }

    const selectionKey = getCommunityWorkSelectionKey(item);

    setSelectedWorkKeys((current) => (
      current.includes(selectionKey)
        ? current.filter((key) => key !== selectionKey)
        : [...current, selectionKey]
    ));
    setManageError('');
  };

  const handleDeleteSelectedWorks = async () => {
    if (!selectedWorkKeys.length || isDeleting) {
      return;
    }

    const selectedItems = state.items.filter((item) => selectedWorkKeySet.has(getCommunityWorkSelectionKey(item)));
    if (selectedItems.length === 0) {
      setSelectedWorkKeys([]);
      return;
    }

    const confirmed = window.confirm(
      `确定删除已选择的 ${selectedItems.length} 个作品吗？此操作无法撤销。`,
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setManageError('');

    const results = await Promise.allSettled(
      selectedItems.map(async (item) => {
        if (item.type === 'card') {
          await cardsApi.deleteCard(item.id);
        } else {
          await boxesApi.deleteBox(item.id);
        }
        return getCommunityWorkSelectionKey(item);
      }),
    );

    const successKeys = results
      .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
      .map((result) => result.value);
    const failedResults = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    if (successKeys.length > 0) {
      const successKeySet = new Set(successKeys);
      setState((current) => ({
        ...current,
        items: current.items.filter((item) => !successKeySet.has(getCommunityWorkSelectionKey(item))),
      }));
    }

    if (failedResults.length > 0) {
      setSelectedWorkKeys(
        results.flatMap((result, index) => (
          result.status === 'rejected'
            ? [getCommunityWorkSelectionKey(selectedItems[index]!)]
            : []
        )),
      );
      setManageError(`有 ${failedResults.length} 个作品删除失败，请稍后重试。`);
    } else {
      setSelectedWorkKeys([]);
      setManageMode(false);
    }

    setIsDeleting(false);
  };

  const handleProfileSubmit = async ({ displayName, bio, avatarFile }: ProfileSettingsPayload) => {
    const currentDisplayName = state.user?.displayName || '';
    const currentBio = state.user?.bio ?? '';
    const shouldPatchProfile = displayName !== currentDisplayName || bio !== currentBio;

    if (!avatarFile && !shouldPatchProfile) {
      setIsProfileSettingsOpen(false);
      return;
    }

    if (avatarFile) {
      await authApi.uploadAvatar(avatarFile);
    }

    if (shouldPatchProfile) {
      await authApi.updateMe({ displayName, bio });
    }

    const refreshedUser = await refreshUser();
    const nextUser = toPublicProfile(refreshedUser);

    setState((current) => (
      current.user
        ? {
            ...current,
            user: nextUser,
          }
        : current
    ));
    setIsProfileSettingsOpen(false);
  };

  const handleLogout = () => {
    setIsProfileSettingsOpen(false);
    setManageMode(false);
    setSelectedWorkKeys([]);
    setManageError('');
    void logout();
  };

  let pageBody: ReactNode;

  if (isProfilePending) {
    pageBody = (
      <>
        <section className="profile-hero profile-hero--skeleton">
          <div className="skeleton-circle" />
          <div className="profile-hero__content">
            <span className="skeleton-line skeleton-line--sm" />
            <span className="skeleton-line skeleton-line--lg" />
            <span className="skeleton-line skeleton-line--md" />
            <span className="skeleton-line skeleton-line--xl" />
          </div>
        </section>

        <section className="works-section">
          <div className="works-section__header">
            <div>
              <span className="skeleton-line skeleton-line--sm" />
              <span className="skeleton-line skeleton-line--md" />
            </div>
          </div>

          <div className="work-grid">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="panel skeleton-tile" />
            ))}
          </div>
        </section>
      </>
    );
  } else if (!state.user || state.error) {
    pageBody = (
      <section className="panel error-panel profile-state">
        <h1>{state.error || '没有找到这个用户。'}</h1>
        <Button onClick={() => setReloadKey((value) => value + 1)}>
          重试
        </Button>
      </section>
    );
  } else {
    pageBody = (
      <>
        <ProfileHero
          user={state.user}
          isOwner={isOwner}
          onOpenSettings={() => setIsProfileSettingsOpen(true)}
          onLogout={handleLogout}
        />
        <WorkGrid
          items={state.items}
          isOwner={isOwner}
          manageMode={manageMode}
          selectedWorkKeys={selectedWorkKeySet}
          manageError={manageError}
          isDeleting={isDeleting}
          onToggleManageMode={handleToggleManageMode}
          onToggleWorkSelection={handleToggleWorkSelection}
          onDeleteSelectedWorks={handleDeleteSelectedWorks}
        />
      </>
    );
  }

  return (
    <div className="page-container profile-page">
      <div className="profile-page__content">{pageBody}</div>

      {state.user && isOwner ? (
        <ProfileSettingsDialog
          isOpen={isProfileSettingsOpen}
          user={state.user}
          onClose={() => setIsProfileSettingsOpen(false)}
          onSubmit={handleProfileSubmit}
        />
      ) : null}
    </div>
  );
}
