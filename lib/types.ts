export interface LumaEvent {
  api_id: string;
  name: string;
  start_at: string;
  end_at: string;
  url: string | null;
  cover_url: string | null;
  geo_address_json: {
    address?: string;
    city?: string;
    region?: string;
    country?: string;
    city_state?: string;
    full_address?: string;
    description?: string;
  } | null;
  geo_latitude: string | null;
  geo_longitude: string | null;
  timezone: string | null;
  creator_api_id: string | null; // user_api_id from event — the event creator
}

export interface LumaHost {
  api_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
}

export interface LumaGuest {
  api_id: string;
  user_api_id: string | null; // matches event.creator_api_id for hosts
  user_name: string;
  user_email: string;
  approval_status: string;
  registered_at: string | null;
  checked_in_at: string | null;
}

export interface LumaPerson {
  api_id: string;
  email: string;
  created_at: string;
  event_approved_count: number;
  event_checked_in_count: number;
  tags: { api_id: string; name: string }[];
  user: {
    api_id: string;
    email: string;
    name: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
}

export interface EventWithGuests {
  event: LumaEvent;
  guests: LumaGuest[];
}

export interface CachedData {
  events: LumaEvent[];
  people: LumaPerson[];
  eventGuests: Record<string, LumaGuest[]>;
  eventHosts: Record<string, LumaHost[]>;
  lastRefreshed: string;
  peopleLastFetched?: string; // separate TTL for people list
}
