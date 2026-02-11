import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

import type { Candidate } from '../types';

const SOCKET_URL = `http://${window.location.hostname}:3001`;

export function usePresentationController(initialIndex: number = 0) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [remoteCandidates, setRemoteCandidates] = useState<Candidate[]>([]);
    const [isIdle, setIsIdle] = useState(false);
    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Connected to socket server');
        });

        newSocket.on('STATE_UPDATE', (data: { currentIndex: number, candidates?: Candidate[], isIdle?: boolean }) => {
            setCurrentIndex(data.currentIndex);
            if (data.candidates && data.candidates.length > 0) {
                setRemoteCandidates(data.candidates);
            }
            if (data.isIdle !== undefined) {
                setIsIdle(data.isIdle);
            }
        });

        return () => {
            newSocket.close();
        };
    }, []);

    const setIndex = useCallback((newIndex: number, candidates?: Candidate[]) => {
        setCurrentIndex(newIndex);
        if (candidates) {
            setRemoteCandidates(candidates);
            socket?.emit('SET_INDEX', { index: newIndex, candidates });
        } else {
            socket?.emit('SET_INDEX', { index: newIndex });
        }
    }, [socket]);

    const toggleIdle = useCallback((idleState: boolean) => {
        setIsIdle(idleState);
        socket?.emit('SET_IDLE', idleState);
    }, [socket]);

    return { currentIndex, setIndex, remoteCandidates, isIdle, toggleIdle };
}
