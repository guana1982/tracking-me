import { prisma } from '../lib/prisma.js';

interface GoogleUserData {
  googleId: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface UserDTO {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  createdAt: string;
}

export class AuthService {
  /**
   * Find or create a user from Google OAuth data
   */
  async findOrCreateUser(data: GoogleUserData): Promise<UserDTO> {
    // Try to find existing user by googleId
    let user = await prisma.user.findUnique({
      where: { googleId: data.googleId },
    });

    if (!user) {
      // Also check by email (in case user exists but googleId changed)
      user = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (user) {
        // Update existing user with googleId
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: data.googleId,
            name: data.name || user.name,
            picture: data.picture || user.picture,
          },
        });
      } else {
        // Create new user
        user = await prisma.user.create({
          data: {
            googleId: data.googleId,
            email: data.email,
            name: data.name || null,
            picture: data.picture || null,
          },
        });
      }
    } else {
      // Update profile info on each login
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: data.name || user.name,
          picture: data.picture || user.picture,
        },
      });
    }

    return this.toDTO(user);
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<UserDTO | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) return null;
    return this.toDTO(user);
  }

  /**
   * Convert Prisma user to DTO
   */
  private toDTO(user: {
    id: string;
    email: string;
    name: string | null;
    picture: string | null;
    createdAt: Date;
  }): UserDTO {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

export const authService = new AuthService();
