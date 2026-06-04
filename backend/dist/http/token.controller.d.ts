import { AuthService } from '../auth/auth.service';
interface JoinBody {
    username?: string;
}
export declare class TokenController {
    private readonly auth;
    constructor(auth: AuthService);
    getToken(body: JoinBody): {
        token: string;
    };
}
export {};
