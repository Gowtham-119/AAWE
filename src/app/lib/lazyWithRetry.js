import React from 'react';

const isChunkLoadError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('loading chunk') || message.includes('chunkloaderror');
};

export const lazyWithRetry = (importer, key) => {
  if (typeof importer !== 'function') {
    throw new Error('lazyWithRetry expects an import function.');
  }

  const cacheKey = `lazy-retry:${key || 'default'}`;

  return React.lazy(async () => {
    try {
      const module = await importer();
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(cacheKey);
      }
      return module;
    } catch (error) {
      const shouldRetry =
        typeof window !== 'undefined' &&
        isChunkLoadError(error) &&
        !window.sessionStorage.getItem(cacheKey);

      if (shouldRetry) {
        window.sessionStorage.setItem(cacheKey, '1');
        window.location.reload();
        return new Promise(() => {});
      }

      throw error;
    }
  });
};
