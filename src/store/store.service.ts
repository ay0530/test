import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductService } from 'src/product/product.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { Store } from './entities/store.entity';

@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    private productService: ProductService,
  ) {}

  // 매장 정보 저장
  async create(createStoreDto: CreateStoreDto, userId: number) {
    // 매장 정보 예외 처리
    await this.existingStore(createStoreDto);

    // 매장 정보 저장
    const store = await this.storeRepository.save({
      user_id: userId,
      name: createStoreDto.name,
      phone_number: createStoreDto.phoneNumber,
      business_number: createStoreDto.bussinessNumber,
      address: createStoreDto.address,
    });

    return store;
  }

  // 매장 정보 상세 조회
  async findOne(id: number) {
    const store = await this.storeRepository.findOne({
      where: { id },
    });
    return {
      name: store.name,
      phone_number: store.phone_number,
      business_number: store.business_number,
      address: store.address,
    };
  }

  // 매장 정보 수정
  async update(id: number, updateStoreDto: UpdateStoreDto, userId: number) {
    // 매장 정보 예외 처리
    await this.existingStore(updateStoreDto);

    // 매장 정보 수정
    await this.storeRepository.update(
      { id, user_id: userId },
      {
        name: updateStoreDto.name,
        phone_number: updateStoreDto.phoneNumber,
        address: updateStoreDto.address,
      },
    );

    return {
      name: updateStoreDto.name,
      phone_number: updateStoreDto.phoneNumber,
      address: updateStoreDto.address,
    };
  }

  // 매장 정보 삭제
  async remove(id: number, userId: number) {
    await this.storeRepository.delete({ id, user_id: userId });
  }

  // 매장 목록 조회
  async findAll() {
    const stores = await this.storeRepository.find();

    return stores;
  }

  // 매장 목록 검색 조회
  async searchAll(category: string, keyword: string) {
    // 매장명, 매장 연락처, 매장 주소로 검색 가능
    const stores = this.storeRepository
      .createQueryBuilder('store')
      .where(`store.${category} LIKE :keyword`, {
        keyword: `%${keyword}%`,
      })
      .getMany();

    return stores;
  }

  // 매장 상품 목록 조회
  async findProductAll(storeId: number) {
    const products = await this.productService.findProductAll(storeId);

    return products;
  }

  // 매장 상품 목록 검색 조회
  async searchProductAll(storeId: number, category: string, keyword: string) {
    // 매장명으로 검색 가능
    const products = this.productService.searchProductAll(
      storeId,
      category,
      keyword,
    );

    return products;
  }

  // ----- 기타 함수
  // 매장 정보 저장/수정 예외 처리
  async existingStore(storeDto: any) {
    // 매장명 중복 여부 체크
    const existingName = await this.storeRepository.findOne({
      where: { name: storeDto.name },
    });
    if (existingName) {
      throw new ConflictException('이미 등록된 매장입니다.');
    }
  }
}
