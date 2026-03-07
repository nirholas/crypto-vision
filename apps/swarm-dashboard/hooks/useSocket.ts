'use client';

import { useSocketContext } from '@/components/shared/socket-provider';

export function useSocket() {
  return useSocketContext();
}
