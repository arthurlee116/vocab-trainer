import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { db } from '../db/client';
import { env } from '../config/env';
import { HttpError } from '../utils/httpError';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

const usersTable = {
  findByEmail: db.prepare<[string], UserRow>('SELECT * FROM users WHERE email = ?'),
  insert: db.prepare(
    'INSERT INTO users (id, email, password_hash, created_at) VALUES (@id, @email, @password_hash, @created_at)',
  ),
};

interface AuthResult {
  user: {
    id: string;
    email: string;
  };
  token: string;
}

export const register = async (email: string, password: string): Promise<AuthResult> => {
  const existing = usersTable.findByEmail.get(email);
  if (existing) {
    throw new HttpError(409, 'Email already registered');
  }

  const id = randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);
  const createdAt = new Date().toISOString();
  usersTable.insert.run({
    id,
    email,
    password_hash: passwordHash,
    created_at: createdAt,
  });

  const token = jwt.sign({ id, email }, env.jwtSecret, { expiresIn: '14d' });

  return {
    user: { id, email },
    token,
  };
};

export const login = async (email: string, password: string): Promise<AuthResult> => {
  const row = usersTable.findByEmail.get(email);
  if (!row) {
    throw new HttpError(401, 'Invalid credentials');
  }

  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    throw new HttpError(401, 'Invalid credentials');
  }

  const token = jwt.sign({ id: row.id, email: row.email }, env.jwtSecret, { expiresIn: '14d' });
  return {
    user: { id: row.id, email: row.email },
    token,
  };
};
