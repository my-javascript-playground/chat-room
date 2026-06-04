import { AuthService } from '../auth/auth.service';
import { UserService } from '../auth/user.service';
interface AuthBody {
    username?: string;
    password?: string;
}
interface PasswordBody {
    password?: string;
}
export declare class TokenController {
    private readonly auth;
    private readonly users;
    constructor(auth: AuthService, users: UserService);
    register(body: AuthBody): Promise<{
        message: string;
    }>;
    getToken(body: AuthBody): Promise<{
        token: string;
        role: string;
    }>;
    changeOwnPassword(authHeader: string, body: {
        currentPassword?: string;
        newPassword?: string;
    }): Promise<{
        message: string;
    }>;
    listUsers(): object[];
    approveUser(id: number): {
        message: string;
    };
    removeUser(id: number, authHeader?: string): {
        message: string;
    };
    adminChangePassword(id: number, body: PasswordBody): Promise<{
        message: string;
    }>;
}
export {};
