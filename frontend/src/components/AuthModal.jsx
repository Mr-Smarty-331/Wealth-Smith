import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL, hostReady } from '../api/config';

const AuthModal = ({ isOpen, onClose, onAuthSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [step, setStep] = useState('credentials'); // 'credentials' or 'otp'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [error, setError] = useState('');
    const [infoMessage, setInfoMessage] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setInfoMessage('');

        // Frontend password validation before hitting the server
        if (!isLogin && step === 'credentials' && password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        setLoading(true);

        // Ensure backend IP is resolved before firing auth requests
        await hostReady;

        const axiosConfig = { timeout: 15000 }; // 15-second timeout

        try {
            if (step === 'otp') {
                // Verify 6-digit OTP to activate secure session
                const res = await axios.post(`${API_BASE_URL}/api/auth/verify-otp`, {
                    email,
                    otp_code: otpCode
                }, axiosConfig);
                if (res.data && res.data.access_token && res.data.user) {
                    onAuthSuccess(res.data);
                    onClose();
                } else {
                    setError('Verification succeeded but received an incomplete response. Please try signing in.');
                }
            } else if (isLogin) {
                // Sign in existing user to create secure active session
                const params = new URLSearchParams();
                params.append('username', email);
                params.append('password', password);

                const res = await axios.post(`${API_BASE_URL}/api/auth/login`, params, {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    ...axiosConfig
                });
                if (res.data && res.data.access_token && res.data.user) {
                    onAuthSuccess(res.data);
                    onClose();
                } else {
                    setError('Sign-in succeeded but received an incomplete response. Please try again.');
                }
            } else {
                // Register new user database entry & send verification OTP
                const res = await axios.post(`${API_BASE_URL}/api/auth/register`, {
                    email,
                    password
                }, axiosConfig);
                if (res.data && res.data.status === 'otp_sent') {
                    setStep('otp');
                    if (res.data.dev_otp_code) {
                        setOtpCode(res.data.dev_otp_code);
                        setInfoMessage(`Development Mode: Verification code ${res.data.dev_otp_code} auto-filled! Click Verify below to test account creation.`);
                    } else {
                        setInfoMessage(`Verification code sent to ${email}. Please check your inbox.`);
                    }
                } else {
                    setError('Registration request completed but no verification code was generated. Please try again.');
                }
            }
        } catch (err) {
            if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
                setError('Server is not responding. Please check your connection and try again.');
            } else {
                const detail = err.response?.data?.detail;
                const msg = typeof detail === 'string'
                    ? detail
                    : (err.message || "Operation failed. Please check your credentials.");
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setStep('credentials');
        setError('');
        setInfoMessage('');
        setOtpCode('');
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
        }}>
            <div className="neo-card" style={{
                width: '100%',
                maxWidth: '420px',
                padding: '36px',
                position: 'relative',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                borderRadius: '24px'
            }}>
                <button 
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '20px',
                        right: '20px',
                        background: 'transparent',
                        border: 'none',
                        fontSize: '1.4rem',
                        cursor: 'pointer',
                        color: 'var(--text-muted)'
                    }}
                >
                    &times;
                </button>

                {/* Mode Switcher Tabs */}
                {step === 'credentials' && (
                    <div style={{
                        display: 'flex',
                        backgroundColor: 'var(--bg-app)',
                        borderRadius: 'var(--radius-pill)',
                        padding: '4px',
                        marginBottom: '24px',
                        border: '1px solid var(--border-light)'
                    }}>
                        <button 
                            onClick={() => { setIsLogin(true); handleReset(); }}
                            style={{
                                flex: 1,
                                padding: '10px',
                                borderRadius: 'var(--radius-pill)',
                                border: 'none',
                                backgroundColor: isLogin ? 'var(--accent-lime)' : 'transparent',
                                color: isLogin ? '#000000' : 'var(--text-muted)',
                                fontWeight: '700',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Sign In
                        </button>
                        <button 
                            onClick={() => { setIsLogin(false); handleReset(); }}
                            style={{
                                flex: 1,
                                padding: '10px',
                                borderRadius: 'var(--radius-pill)',
                                border: 'none',
                                backgroundColor: !isLogin ? 'var(--accent-lime)' : 'transparent',
                                color: !isLogin ? '#000000' : 'var(--text-muted)',
                                fontWeight: '700',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Register
                        </button>
                    </div>
                )}

                <h2 style={{ fontSize: '1.6rem', fontWeight: '800', marginBottom: '8px', color: 'var(--text-dark)', textAlign: 'center' }}>
                    {step === 'otp' ? 'Verify Email Code' : isLogin ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '24px' }}>
                    {step === 'otp' 
                        ? 'Enter the 6-digit verification code sent to your email.' 
                        : isLogin 
                        ? 'Sign in to access your secure persistent trading session.' 
                        : 'Register a new database user account to sync portfolios.'}
                </p>

                {error && (
                    <div style={{ padding: '10px 14px', borderRadius: '12px', backgroundColor: 'rgba(255, 42, 42, 0.1)', border: '1px solid #ff2a2a', color: '#ff2a2a', fontSize: '0.85rem', fontWeight: '600', marginBottom: '16px', textAlign: 'center' }}>
                        {error}
                    </div>
                )}

                {infoMessage && (
                    <div style={{ padding: '10px 14px', borderRadius: '12px', backgroundColor: 'rgba(196, 255, 0, 0.15)', border: '1px solid var(--accent-lime)', color: 'var(--text-dark)', fontSize: '0.85rem', fontWeight: '600', marginBottom: '16px', textAlign: 'center' }}>
                        {infoMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {step === 'credentials' ? (
                        <>
                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Email Address</label>
                                <input 
                                    type="email" 
                                    placeholder="name@gmail.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '12px 18px',
                                        borderRadius: 'var(--radius-pill)',
                                        border: '1px solid var(--border-light)',
                                        backgroundColor: 'var(--bg-app)',
                                        color: 'var(--text-dark)',
                                        outline: 'none',
                                        fontWeight: '600'
                                    }}
                                    required
                                />
                            </div>

                            <div>
                                <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Password</label>
                                <input 
                                    type="password" 
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '12px 18px',
                                        borderRadius: 'var(--radius-pill)',
                                        border: '1px solid var(--border-light)',
                                        backgroundColor: 'var(--bg-app)',
                                        color: 'var(--text-dark)',
                                        outline: 'none',
                                        fontWeight: '600'
                                    }}
                                    required
                                />
                            </div>
                        </>
                    ) : (
                        <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px', textAlign: 'center' }}>6-Digit OTP Code</label>
                            <input 
                                type="text" 
                                placeholder="123456"
                                maxLength={6}
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '14px 18px',
                                    borderRadius: 'var(--radius-pill)',
                                    border: '2px solid var(--accent-lime)',
                                    backgroundColor: 'var(--bg-app)',
                                    color: 'var(--text-dark)',
                                    outline: 'none',
                                    fontWeight: '800',
                                    fontSize: '1.4rem',
                                    letterSpacing: '8px',
                                    textAlign: 'center'
                                }}
                                required
                            />
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="btn-primary-pill"
                        style={{
                            marginTop: '10px',
                            padding: '14px',
                            backgroundColor: isLogin ? 'var(--accent-lime)' : 'var(--bg-dark)',
                            color: isLogin ? '#000000' : 'var(--text-light)',
                            border: 'none',
                            borderRadius: 'var(--radius-pill)',
                            fontWeight: '800',
                            cursor: 'pointer',
                            fontSize: '0.95rem'
                        }}
                    >
                        {loading ? 'Processing...' : step === 'otp' ? 'Verify & Activate Session' : isLogin ? 'Sign In to Account' : 'Register & Send Code'}
                    </button>
                </form>

                <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {step === 'credentials' ? (
                        <>
                            {isLogin ? "Don't have an account database entry?" : "Already registered?"}{' '}
                            <span 
                                onClick={() => { setIsLogin(!isLogin); handleReset(); }}
                                style={{ color: 'var(--accent-lime)', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                                {isLogin ? 'Register New Account' : 'Sign In'}
                            </span>
                        </>
                    ) : (
                        <>
                            Entered wrong details?{' '}
                            <span 
                                onClick={handleReset}
                                style={{ color: 'var(--accent-lime)', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                                Start Over
                            </span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
