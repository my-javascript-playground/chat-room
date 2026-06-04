export interface TokenPayload {
    username: string;
    iat?: number;
    exp?: number;
}
export declare class AuthService {
    private readonly secret;
    private readonly expiresIn;
    sign(username: string): string;
    verify(token: string): TokenPayload;
}
