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
        const qr = this.dataSource.createQueryRunner();

        await qr.connect();
        await qr.startTransaction();

        client.data.client = qr;

        return next
            .handle()
            .pipe(
                catchError(
                    async (error) => {
                        await qr.rollbackTransaction();
                        await qr.release();

                        throw error;
                    },
                ),
                tap(async () => {
                    await qr.rollbackTransaction();
                    await qr.release();
                }),
            );
    };
}
