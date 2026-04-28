import { NextFunction, Response } from 'express';
import { verify } from 'jsonwebtoken';
import { AuthRequest, JwtPayload } from '../types';

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ message: 'Invalid or expired token' });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ message: 'Internal server error' });
    return;
  }

  try {
    const decoded = verify(token, secret) as JwtPayload;
    if (!decoded.userId || typeof decoded.userId !== 'string') {
      res.status(401).json({ message: 'Invalid token payload' });
      return;
    }

    if (!decoded.role) {
      res.status(401).json({ message: 'Invalid token payload' });
      return;
    }

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      iat: decoded.iat,
      exp: decoded.exp,
    };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};
