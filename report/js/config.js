// ---- localStorage keys ----
const LS_PAT  = 'claude_usage_stats_pat';
const LS_REPO = 'claude_usage_stats_repo';
const LS_FILE = 'claude_usage_stats_file';

const LS_API_URL = 'claude_usage_stats_api_url';
const LS_API_KEY = 'claude_usage_stats_api_key';

const LS_PRICE_INPUT       = 'claude_usage_stats_price_input';
const LS_PRICE_CACHE_READ  = 'claude_usage_stats_price_cache_read';
const LS_PRICE_CACHE_WRITE = 'claude_usage_stats_price_cache_write';
const LS_PRICE_OUTPUT      = 'claude_usage_stats_price_output';

let globalData = null;
let activeProfile = null;
let activeModels = new Set(); // empty = All models shown
let tokChart = null;
let ctxChart = null;
