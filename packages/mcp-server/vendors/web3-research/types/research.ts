/**
 * Web3 Research Types
 * 
 * @author nich
 * @website https://x.com/nichxbt
 * @github https://github.com/nirholas
 * @license Apache-2.0
 */
export interface ResearchLog {
  timestamp: string;
  message: string;
}

export interface ResearchPlan {
  [key: string]: {
    description: string;
    sources: string[];
    status: "planned" | "in_progress" | "completed";
  };
}

export interface ResearchData {
  tokenName: string;
  tokenTicker: string;
  researchPlan: ResearchPlan;
  searchResults: Record<string, any>;
  technicalData: Record<string, any>;
  marketData: Record<string, any>;
  socialData: Record<string, any>;
  newsData: Array<{
    title: string;
    url: string;
    excerpt?: string;
    date?: string;
    source?: string;
  }>;
  teamData: Record<string, any>;
  relatedTokens: Array<any>;
  status: "not_started" | "in_progress" | "completed";
  logs: ResearchLog[];
}
