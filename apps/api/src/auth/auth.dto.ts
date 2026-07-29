import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail() @MaxLength(254) email!: string; // 254 = máximo real de un email (RFC 5321)
  // 72 = límite real de bcrypt (trunca en silencio a partir de ahí); sin tope, una cadena
  // enorme fuerza a bcrypt a hashear igual — DoS barato (auditoría, hallazgo bajo).
  @IsString() @MinLength(6) @MaxLength(72) password!: string;
}

export class RefreshDto {
  @IsString() @MaxLength(128) refreshToken!: string; // el token real son 64 chars hex (32 bytes)
}
