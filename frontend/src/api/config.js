// Centralized Enterprise API & WebSocket Configuration for Wealth Smith
// Utilizes AWS Application Load Balancer (ALB) for permanent, zero-hardcoded-IP connectivity.

const PERMANENT_ALB_DNS = "wealth-smith-alb-1384513505.us-east-1.elb.amazonaws.com";

const getBaseUrl = () => {
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL.replace(/\/$/, '');
    }
    return `http://${PERMANENT_ALB_DNS}`;
};

const _baseUrl = getBaseUrl();

export const API_BASE_URL = {
    toString() { return _baseUrl; },
    valueOf() { return _baseUrl; }
};

export const WS_BASE_URL = {
    toString() { return _baseUrl.replace(/^http/, 'ws'); },
    valueOf() { return _baseUrl.replace(/^http/, 'ws'); }
};

export const hostReady = Promise.resolve(_baseUrl);
