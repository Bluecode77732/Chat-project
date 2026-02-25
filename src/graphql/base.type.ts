import { Field } from "@nestjs/graphql";

export class BaseType {
    @Field()
    created: Date;
    
    @Field()
    updated: Date;
}
