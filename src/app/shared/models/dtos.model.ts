export interface LoginCredentialDto {
  userName: string;
  password: string;
}

// Matches ServiceTokenApi.Dto.CompanyRequestDto
export interface CompanyRequestDto {
  name: string;
  taxCode: string;
  userName: string;
  password: string;
}

// Matches ServiceTokenApi.Dto.InvestorCreateDto (entity fields)
export interface InvestorCreateDto {
  publicKey: string;
  userName: string;
  password: string;
}

// Matches ServiceTokenApi.Dto.RequestDto
export interface RequestDto {
  companyId: number;
  productId: number;
  serviceTokenCount: number;
}
