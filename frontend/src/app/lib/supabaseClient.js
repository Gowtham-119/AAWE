import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const MISSING_SUPABASE_MESSAGE = 'Supabase is not configured. Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.';

const createMissingSupabaseError = () => new Error(MISSING_SUPABASE_MESSAGE);

const createNoopQueryBuilder = () => {
  const builder = {
    select: () => proxy,
    eq: () => proxy,
    ilike: () => proxy,
    in: () => proxy,
    order: () => proxy,
    limit: () => proxy,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: createMissingSupabaseError() }),
    insert: async () => ({ data: null, error: createMissingSupabaseError() }),
    update: async () => ({ data: null, error: createMissingSupabaseError() }),
    upsert: async () => ({ data: null, error: createMissingSupabaseError() }),
    delete: async () => ({ data: null, error: createMissingSupabaseError() }),
    rpc: async () => ({ data: null, error: createMissingSupabaseError() }),
    then: (resolve, reject) => Promise.resolve({ data: null, error: null }).then(resolve, reject),
  };

  const proxy = new Proxy(builder, {
    get(target, property) {
      if (property in target) {
        return target[property];
      }

      if (typeof property === 'string') {
        return () => proxy;
      }

      return undefined;
    },
  });

  return proxy;
};

const createNoopSupabaseClient = () => ({
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithPassword: async () => ({ data: null, error: createMissingSupabaseError() }),
    signInWithOAuth: async () => ({ data: null, error: createMissingSupabaseError() }),
    resetPasswordForEmail: async () => ({ data: null, error: createMissingSupabaseError() }),
    signOut: async () => ({ error: null }),
  },
  from: () => createNoopQueryBuilder(),
  rpc: async () => ({ data: null, error: createMissingSupabaseError() }),
});

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createNoopSupabaseClient();

if (!isSupabaseConfigured && typeof console !== 'undefined') {
  console.warn(MISSING_SUPABASE_MESSAGE);
}
