import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  // No DB/Redis seed data required — this only confirms the full app boots and the
  // real request pipeline (routing, cookie parsing, global exception filter) works.
  it('/auth/token/refreshaccess (POST) without a refresh cookie returns 401', () => {
    return request(app.getHttpServer())
      .post('/auth/token/refreshaccess')
      .expect(401);
  });
});
