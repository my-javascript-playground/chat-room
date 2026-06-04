import { AuthService } from '../auth/auth.service';
import { UserService } from '../auth/user.service';
interface AuthBody {
    username?: string;
    password?: string;
}
export declare class TokenController {
    private readonly auth;
    private readonly users;
    constructor(auth: AuthService, users: UserService);
    register(body: AuthBody): Promise<{
        token: string;
    }>;
    getToken(body: AuthBody): Promise<{
        token: string;
    }>;
}
export {};
