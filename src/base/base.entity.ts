import { ApiHideProperty } from "@nestjs/swagger";
import { Exclude } from "class-transformer";
import { CreateDateColumn, UpdateDateColumn } from "typeorm";

export class EntityBase {
    @CreateDateColumn()
    @ApiHideProperty()
    @Exclude()
    created: Date;
    
    @UpdateDateColumn()
    @ApiHideProperty()
    @Exclude()
    updated: Date;
}
