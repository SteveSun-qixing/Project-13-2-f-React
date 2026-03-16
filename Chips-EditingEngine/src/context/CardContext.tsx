import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { getCardService, type CompositeCard, type CardServiceState } from '../core/card-service';
import { globalEventEmitter } from '../core/event-emitter';
import type { BasecardResourceOperations } from '../basecard-runtime/contracts';
import type { CardCoverResource } from '../utils/card-cover';

export interface CardState {
    openCards: Map<string, CompositeCard>;
    activeCardId: string | null;
    selectedBaseCardId: string | null;
}

export interface CardContextType extends CardState {
    openCard: (cardId: string, path: string) => Promise<void>;
    closeCard: (cardId: string) => void;
    setActiveCard: (cardId: string | null) => void;
    setSelectedBaseCard: (baseCardId: string | null) => void;
    updateCard: (cardId: string, updates: Partial<CompositeCard>) => void;
    updateCardMetadata: (cardId: string, metadata: Partial<CompositeCard['metadata']>) => void;
    updateCardCover: (cardId: string, cover: { html: string; ratio?: string; resources?: CardCoverResource[] }) => void;
    createCard: (name: string, initialBasicCard?: { type: string; data?: Record<string, unknown> }) => Promise<CompositeCard>;
    saveCard: (id: string) => Promise<void>;
    addBasicCard: (cardId: string, type: string, data?: Record<string, unknown>, position?: number) => Promise<CompositeCard['structure']['basicCards'][number] | null>;
    removeBasicCard: (cardId: string, basicCardId: string) => void;
    moveBasicCard: (cardId: string, basicCardId: string, newPosition: number) => void;
    updateBasicCard: (
        cardId: string,
        basicCardId: string,
        data: Record<string, unknown>,
        resourceOperations?: BasecardResourceOperations,
    ) => void;
    toggleEditMode: (id: string) => void;
    getCard: (id: string) => CompositeCard | undefined;
}

const CardContext = createContext<CardContextType | undefined>(undefined);

export function CardProvider({ children }: { children: ReactNode }) {
    const [openCards, setOpenCards] = useState<Map<string, CompositeCard>>(new Map());
    const [activeCardId, setActiveCardId] = useState<string | null>(null);
    const [selectedBaseCardId, setSelectedBaseCardId] = useState<string | null>(null);

    const cardService = getCardService();

    useEffect(() => {
        const unsubscribe = cardService.subscribe((state: CardServiceState) => {
            setOpenCards(new Map(state.openedCards));
            setActiveCardId(state.selectedCardId);
            setSelectedBaseCardId(state.selectedBasicCardId);
        });

        const handleCardCreated = (data: any) => {
            if (data.card) {
                setOpenCards(prev => new Map(prev).set(data.card.id, data.card));
            }
        };

        const handleCardOpened = (data: any) => {
            if (data.card) {
                setOpenCards(prev => new Map(prev).set(data.card.id, data.card));
            }
        };

        const handleCardClosed = (data: any) => {
            if (data.card) {
                setOpenCards(prev => {
                    const next = new Map(prev);
                    next.delete(data.card.id);
                    return next;
                });
            }
        };

        globalEventEmitter.on('card:created', handleCardCreated);
        globalEventEmitter.on('card:opened', handleCardOpened);
        globalEventEmitter.on('card:closed', handleCardClosed);

        return () => {
            unsubscribe();
            globalEventEmitter.off('card:created', handleCardCreated);
            globalEventEmitter.off('card:opened', handleCardOpened);
            globalEventEmitter.off('card:closed', handleCardClosed);
        };
    }, [cardService]);

    const openCard = useCallback(async (cardId: string, path: string) => {
        await cardService.openCard(cardId, path);
    }, [cardService]);

    const closeCard = useCallback((cardId: string) => {
        cardService.closeCard(cardId);
    }, [cardService]);

    const updateCard = useCallback((cardId: string, updates: Partial<CompositeCard>) => {
        const card = cardService.getCard(cardId);
        if (card) {
            Object.assign(card, updates);
        }
    }, [cardService]);

    const createCard = useCallback(async (name: string, initialBasicCard?: { type: string; data?: Record<string, unknown> }) => {
        return cardService.createCard(name, initialBasicCard);
    }, [cardService]);

    const updateCardMetadata = useCallback((cardId: string, metadata: Partial<CompositeCard['metadata']>) => {
        cardService.updateCardMetadata(cardId, metadata);
    }, [cardService]);

    const updateCardCover = useCallback((cardId: string, cover: { html: string; ratio?: string; resources?: CardCoverResource[] }) => {
        cardService.updateCardCover(cardId, cover);
    }, [cardService]);

    const saveCard = useCallback(async (id: string) => {
        return cardService.saveCard(id);
    }, [cardService]);

    const addBasicCard = useCallback((cardId: string, type: string, data?: Record<string, unknown>, position?: number) => {
        return cardService.addBasicCard(cardId, type, data, position);
    }, [cardService]);

    const removeBasicCard = useCallback((cardId: string, basicCardId: string) => {
        cardService.removeBasicCard(cardId, basicCardId);
    }, [cardService]);

    const moveBasicCard = useCallback((cardId: string, basicCardId: string, newPosition: number) => {
        cardService.moveBasicCard(cardId, basicCardId, newPosition);
    }, [cardService]);

    const updateBasicCard = useCallback((
        cardId: string,
        basicCardId: string,
        data: Record<string, unknown>,
        resourceOperations?: BasecardResourceOperations,
    ) => {
        cardService.updateBasicCard(cardId, basicCardId, data, resourceOperations);
    }, [cardService]);

    const toggleEditMode = useCallback((id: string) => {
        cardService.toggleEditMode(id);
    }, [cardService]);

    const getCard = useCallback((id: string) => {
        return cardService.getCard(id);
    }, [cardService]);

    const setActiveCard = useCallback((cardId: string | null) => {
        cardService.selectCard(cardId);
    }, [cardService]);

    const setSelectedBaseCard = useCallback((baseCardId: string | null) => {
        cardService.selectBasicCard(baseCardId);
    }, [cardService]);

    const value: CardContextType = {
        openCards,
        activeCardId,
        selectedBaseCardId,
        openCard,
        closeCard,
        setActiveCard,
        setSelectedBaseCard,
        updateCard,
        updateCardMetadata,
        updateCardCover,
        createCard,
        saveCard,
        addBasicCard,
        removeBasicCard,
        moveBasicCard,
        updateBasicCard,
        toggleEditMode,
        getCard,
    };

    return <CardContext.Provider value={value}>{children}</CardContext.Provider>;
}

export function useCard() {
    const context = useContext(CardContext);
    if (context === undefined) {
        throw new Error('useCard must be used within a CardProvider');
    }
    return context;
}
