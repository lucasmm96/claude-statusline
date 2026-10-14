// ---- localStorage keys ----
const LS_PAT  = 'statusline_pat';
const LS_REPO = 'statusline_repo';
const LS_FILE = 'statusline_file';

const LS_PRICE_INPUT       = 'statusline_price_input';
const LS_PRICE_CACHE_READ  = 'statusline_price_cache_read';
const LS_PRICE_CACHE_WRITE = 'statusline_price_cache_write';
const LS_PRICE_OUTPUT      = 'statusline_price_output';

let globalData = null;
let activeProfile = null;
let tokChart = null;
let ctxChart = null;
