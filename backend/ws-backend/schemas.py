from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

# Auth
class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class GoogleTokenSchema(BaseModel):
    id_token: str

class VerifyOTP(BaseModel):
    email: EmailStr
    otp_code: str

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    cash_balance: float
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenData(BaseModel):
    email: Optional[str] = None

# Trading
class HoldingResponse(BaseModel):
    ticker: str
    shares: float
    buyPrice: float

    class Config:
        from_attributes = True

class TradeExecute(BaseModel):
    action: str  # BUY or SELL
    symbol: str
    shares: float
    price: float

class PortfolioResponse(BaseModel):
    cash: float
    holdings: List[HoldingResponse]
