import { Reflector } from "@nestjs/core";
import { UserRole } from "../role/role";

export const RBAC = Reflector.createDecorator<UserRole>();
