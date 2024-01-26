import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Between, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { User } from 'src/user/entities/user.entity';
import { ProductService } from 'src/product/product.service';
import _ from 'lodash';
import { UpdateOrderDeliveryDto } from './dto/update-order-delivery.dto';
@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly productService: ProductService,
  ) {}

  async create(createOrderDto: CreateOrderDto, user: User) {
    //결제는 다른 api에서 진행. 정말 order 생성만 진행한다.

    //해당하는 product의 정보를 가져와 현재 값을 같이 저장한다.

    const {
      product_id,
      receiver,
      receiver_phone_number,
      delivery_name,
      delivery_address,
      delivery_request,
      quantity,
      post_code,
    } = createOrderDto;
    const product = await this.productService.getProductDetail(
      product_id,
      user.id,
    );

    //우리 쇼핑몰 구매는 기부 사이트의 point가 아닌 price로 진행함
    //product id는 현재 판매하는 상품으로 연결할 때 사용, name과 price는 변동 가능성 있으니 저장
    const createOrder = await this.orderRepository.save({
      product_id,
      status: '입금대기',
      receiver,
      receiver_phone_number,
      delivery_name,
      delivery_address,
      delivery_request,
      quantity,
      product_name: product.name,
      product_price: product.price,
      post_code,
      user_id: user.id,
    });

    return createOrder;
  }

  async findAllByUser(user: User) {
    const orders = await this.orderRepository.find({
      where: { user_id: user.id },
      order: {
        createdAt: 'DESC', // createdAt을 기준으로 내림차순 정렬
      },
      select: [
        'id',
        'status',
        'product_name',
        'product_price',
        'quantity',
        'createdAt',
      ],
    });

    return {
      order_count: orders.length,
      data: orders,
    };
  }

  async findAllByProduct(productId: number) {
    const orders = await this.orderRepository.find({
      where: { product_id: productId },
      order: {
        createdAt: 'DESC', // createdAt을 기준으로 내림차순 정렬
      },
      select: [
        'id',
        'status',
        'product_name',
        'product_price',
        'quantity',
        'createdAt',
      ],
    });

    return {
      order_count: orders.length,
      data: orders,
    };
  }

  async findAllByUserPeriod(period: string, user: User) {
    let startDate = new Date();
    const periodValue = Number(period.replace(/\D/g, ''));

    if (period.includes('day')) {
      startDate.setDate(startDate.getDate() - periodValue);
    } else if (period.includes('month')) {
      startDate.setMonth(startDate.getMonth() - periodValue);
    } else {
      //default는 전체 주문을 보여준다.
      return this.findAllByUser(user);
    }

    //기간 별 조회
    const orders = await this.orderRepository.find({
      where: { user_id: user.id, createdAt: Between(startDate, new Date()) },
      order: {
        createdAt: 'DESC', // createdAt을 기준으로 내림차순 정렬
      },
      select: [
        'id',
        'status',
        'product_name',
        'product_price',
        'quantity',
        'createdAt',
      ],
    });

    return {
      order_count: orders.length,
      data: orders,
    };
  }

  async findAllByUserStatus(status: string, user: User) {
    const orders = await this.orderRepository.find({
      where: { user_id: user.id, status: status },
      order: {
        createdAt: 'DESC', // createdAt을 기준으로 내림차순 정렬
      },
      select: [
        'id',
        'status',
        'product_name',
        'product_price',
        'quantity',
        'createdAt',
      ],
    });

    return {
      order_count: orders.length,
      data: orders,
    };
  }

  async findOne(id: number, user: User) {
    //해당 user가 id에 해당하는 order의 소유인지 확인하기 위해 user_id도 같이 확인
    const order = await this.orderRepository.findOne({
      where: { id, user_id: user.id },
    });

    if (_.isNil(order)) {
      throw new NotFoundException(
        '해당 상품의 구매 내역을 확인할 수 없습니다.',
      );
    }

    return order;
  }

  async getOrderStatus(id: number) {
    const order = await this.orderRepository.findOne({
      where: { id },
      select: ['status'],
    });

    return order.status;
  }

  async updateAdmin(id: number, updateOrderDto: UpdateOrderDto) {
    const { status } = updateOrderDto;

    //order update
    const order = await this.orderRepository.findOne({
      where: { id },
    });

    if (_.isNil(order)) {
      throw new NotFoundException(
        '해당 상품의 구매 내역을 확인할 수 없습니다.',
      );
    }

    if (order.status === '환불신청' || order.status === '환불완료') {
      throw new BadRequestException('해당 주문은 환불을 신청하였습니다.');
    }

    order.status = status;
    const updateOrder = await this.orderRepository.save(order);

    return updateOrder;
  }

  async updateAddress(
    id: number,
    updateOrderDeliveryDto: UpdateOrderDeliveryDto,
    user: User,
  ) {
    const {
      receiver,
      receiver_phone_number,
      delivery_name,
      delivery_address,
      post_code,
      delivery_request,
    } = updateOrderDeliveryDto;

    const order = await this.orderRepository.findOne({
      where: { id, user_id: user.id },
    });

    if (_.isNil(order)) {
      throw new NotFoundException(
        '해당 상품의 구매 내역을 확인할 수 없습니다.',
      );
    }
    //배송 중일 때는 배송지 변경이 불가능
    if (order.status !== '입금대기' && order.status !== '입금완료') {
      throw new BadRequestException('해당 상품은 배송지 변경이 불가능합니다.');
    }

    order.receiver = receiver;
    order.receiver_phone_number = receiver_phone_number;
    order.delivery_name = delivery_name;
    order.delivery_address = delivery_address;
    order.post_code = post_code;
    order.delivery_request = delivery_request;

    const updateOrder = await this.orderRepository.save(order);

    return updateOrder;
  }

  async updateConfirm(id: number, updateOrderDto: UpdateOrderDto, user: User) {
    const { status } = updateOrderDto;

    //dto의 status가 명확한지 한 번 더 확인
    if (status !== '구매확정') {
      throw new BadRequestException('잘못된 신청입니다.');
    }

    //order update
    const order = await this.orderRepository.findOne({
      where: { id, user_id: user.id },
    });

    if (_.isNil(order)) {
      throw new NotFoundException(
        '해당 상품의 구매 내역을 확인할 수 없습니다.',
      );
    }

    if (order.status === '환불신청' || order.status === '환불완료') {
      throw new BadRequestException('해당 상품은 구매확정이 불가능 합니다.');
    }

    order.status = status;
    const updateOrder = await this.orderRepository.save(order);

    return updateOrder;
  }

  async refundRequest(id: number, updateOrderDto: UpdateOrderDto, user: User) {
    const { status } = updateOrderDto;

    //구매 확정, 환불 신청, 환불 완료인 상태는 환불 신청이 불가능함.
    //추가로 구매 완료된 시간을 확인해서 구매 시간이 일정 시간이 지나면 불가능 하도록.
    const currentStatus = await this.getOrderStatus(id);
    if (
      currentStatus === '구매확정' ||
      currentStatus === '환불신청' ||
      currentStatus === '환불완료'
    ) {
      throw new BadRequestException('해당 상품은 환불신청이 불가능 합니다.');
    }

    //dto의 status가 명확한지 한 번 더 확인
    if (status !== '환불신청') {
      throw new BadRequestException('잘못된 신청입니다.');
    }

    //order update
    const order = await this.orderRepository.findOne({
      where: { id, user_id: user.id },
    });

    if (_.isNil(order)) {
      throw new NotFoundException(
        '해당 상품의 구매 내역을 확인할 수 없습니다.',
      );
    }

    order.status = status;
    const refundOrder = await this.orderRepository.save(order);

    return refundOrder;
  }

  async refundComplete(id: number, updateOrderDto: UpdateOrderDto, user: User) {
    const { status } = updateOrderDto;

    //환불 신청이 와있는 중인지 status 확인 환불 중 일때만 환불 진행 아니면 x
    const currentStatus = await this.getOrderStatus(id);
    if (currentStatus !== '환불신청') {
      throw new BadRequestException('해당 상품은 환불신청을 하지 않았습니다.');
    }

    //해당 user가 id에 해당하는 order의 소유인지 확인하기 위해 user_id도 같이 확인
    const order = await this.orderRepository.findOne({
      where: { id, user_id: user.id },
    });

    if (_.isNil(order)) {
      throw new NotFoundException(
        '해당 상품의 구매 내역을 확인할 수 없습니다.',
      );
    }

    //결제상으로 환불 불러오기
    order.status = status;
    const refundOrder = await this.orderRepository.save(order);

    return refundOrder;
  }
}
