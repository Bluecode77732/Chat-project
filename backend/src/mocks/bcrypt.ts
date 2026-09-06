// bcrypt 모듈을 테스트용으로 모킹함

const bcrypt = {
  hash: jest.fn(),
  compare: jest.fn(),
  genSalt: jest.fn(),
};

export default bcrypt;
export const { hash, compare, genSalt } = bcrypt;
