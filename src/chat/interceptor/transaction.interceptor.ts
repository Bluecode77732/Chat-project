import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { DataSource } from "typeorm";
import { catchError, Observable, tap } from "rxjs";

@Injectable()
export class Transaction implements NestInterceptor {
    constructor(
        private readonly dataSource: DataSource,
    ) { };

    // This logic processes logic for response before core functions are called.
    async intercept(ctx: ExecutionContext, next: CallHandler<string>): Promise<Observable<string>> {
        const request = ctx.switchToHttp().getRequest();
        const queryRunner = this.dataSource.createQueryRunner();

        await queryRunner.connect();
        await queryRunner.startTransaction();

        request.queryRunner = queryRunner;

        return next
            .handle()
            .pipe(
                catchError(
                    async (error) => {
                        await queryRunner.rollbackTransaction();
                        await queryRunner.release();
                        
                        throw error;
                    },
                ),
                tap(async () => {
                    //! Debug - Save message in DB: `rollbackTransaction` => `commitTransaction` which wasn't added.
                    await queryRunner.commitTransaction();
                    await queryRunner.release();
                }),
            );
    };
}
