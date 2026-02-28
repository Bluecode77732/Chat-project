import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { DataSource } from "typeorm";
import { catchError, Observable, tap } from "rxjs";

@Injectable()
export class WebSocketTransaction implements NestInterceptor {
    constructor(
        private readonly dataSource: DataSource,
    ) { };

    // This logic processes logic for response before core functions are called.
    async intercept(ctx: ExecutionContext, next: CallHandler<string>): Promise<Observable<string>> {
        const client = ctx.switchToWs().getClient();
        const queryRunner = this.dataSource.createQueryRunner();

        //! Debug: Implement transaction for sendMessage in chat.service
        await queryRunner.connect();
        console.log('📨 QueryRunner connected');
        await queryRunner.startTransaction();
        console.log('📨 Transaction started');

        // The `client.body.queryRunner` accesses the `queryRunner` which creates connection of DB.
        client.data.queryRunner = queryRunner;

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
                    //!? Debug - Save message in DB: `rollbackTransaction` => `commitTransaction`; Is this correct debugging?
                    await queryRunner.commitTransaction();
                    await queryRunner.release();
                }),
            );
    };
}
