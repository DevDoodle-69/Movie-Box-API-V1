export interface FlatStream {
  resourceLink: string;
  resolution: number;
  se: number;
  ep: number;
  codecName?: string;
  duration?: number;
  size?: string;
  title?: string;
  uploadBy?: string;
  sourceUrl?: string;
  requireMemberType?: number;
}

export interface Resolution {
  resolution: number;
  resourceLink: string;
  title: string;
  codecName: string;
  duration: number;
  size: string;
  se: number;
  ep: number;
}

export interface ResourceDetector {
  type: number;
  totalEpisode: number;
  downloadUrl: string;
  resolutionList: Resolution[];
  subjectId: string;
  codecName: string;
}

export interface Cover {
  url: string;
  width: number;
  height: number;
  thumbnail?: string;
}

export interface StaffMember {
  name: string;
  role?: string;
  avatar?: string;
  staffType?: number;
}

export interface ContentItem {
  subjectId: string;
  subjectType: number;
  title: string;
  description?: string;
  releaseDate?: string;
  duration?: string;
  genre?: string;
  cover?: Cover;
  countryName?: string;
  language?: string;
  imdbRatingValue?: string;
  staffList?: StaffMember[];
  resourceDetectors?: ResourceDetector[];
  corner?: string;
  contentRating?: string;
  seNum?: number;
  season?: number;
  detailUrl?: string;
  isCam?: boolean;
  stills?: Cover;
}

export interface NormalizedItem {
  subjectId: string;
  title: string;
  type: string;
  subjectType: number;
  coverUrl: string;
  releaseDate?: string;
  genre?: string;
  rating?: string;
  country?: string;
  season?: number;
  duration?: string;
  corner?: string;
  description?: string;
}

export interface Pager {
  hasMore: boolean;
  nextPage: string;
  page: string;
  perPage: number;
  totalCount: number;
}

export interface SearchResult {
  success: boolean;
  items: NormalizedItem[];
  pager: Pager;
  count: number;
  query: string;
  page: number;
}

export interface Episode {
  episodeId?: string;
  episode: number;
  title?: string;
  coverUrl?: string;
  duration?: string;
}

export interface Season {
  season: number;
  episodes: Episode[];
  totalEpisodes?: number;
}

export interface ItemDetail {
  success: boolean;
  subjectId: string;
  title: string;
  type: string;
  subjectType: number;
  coverUrl: string;
  releaseDate?: string;
  genre?: string;
  rating?: string;
  ratingCount?: string;
  country?: string;
  language?: string;
  duration?: string;
  description?: string;
  staffList?: StaffMember[];
  streams?: FlatStream[];
  totalStreams?: number;
  bestStream?: FlatStream;
  playInfo?: unknown;
  seasons?: Season[];
  totalSeasons?: number;
  seNum?: number;
  errors?: Record<string, string>;
  contentRating?: string;
  corner?: string;
  tagList?: string[];
}

export interface SuggestionItem extends NormalizedItem {}

export interface SuggestResult {
  success: boolean;
  suggestions: SuggestionItem[];
  count: number;
}

export interface HomepageBanner {
  subjectId: string;
  title: string;
  coverUrl: string;
  type?: string;
}

export interface HomepageRow {
  title: string;
  items: ContentItem[];
}

export interface HomepageResult {
  success: boolean;
  banners?: HomepageBanner[];
  rows?: HomepageRow[];
  data?: {
    banners?: HomepageBanner[];
    rows?: HomepageRow[];
  };
}

export interface TrendingResult {
  success: boolean;
  data?: {
    items?: ContentItem[];
  };
  items?: ContentItem[];
}
