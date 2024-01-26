const puppeteer = require('puppeteer');
const axios = require('axios');
// import "reflect-metadata";
// import { createConnection } from 'typeorm';
// import { Product } from './entity/Product';
// 크롤링이 실패할 경우 개발자에게 연락을 취하는 로직 구현해야할 듯
// 크롤링이 실패할 경우 -> 고사기의 html 구성이 바뀌어 값들을 제대로 가져오지 못 할 때가 예상됨

// 상품 목록에서 상품 코드 크롤링하기
async function scrapeProductCode(url) {
  const browser = await puppeteer.launch({
    headless: true, // 브라우저를 화면이 없는 모드로 실행 -> 백그라운드에서 브라우저가 열림
    // --no-sandbox : Chromium 브라우저의 Sandbox 옵션 비활성화
    // --disable-dev-shm-usage : Chromium 브라우저의 Shared Memory 비활성화
    // Chromium 브라우저 : Chrome의 오픈 소스 버전, Puppeteer를 실행했을 때 사용됨(Puppeteer 아니어도 사용!!)
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.createIncognitoBrowserContext(); // 시크릿 모드 설정
  const page = await context.newPage(); // 새로운 페이지 실행

  // 로그인
  await login(page);

  // 상품 목록에서 상품 코드 추출
  const productCodeList = await getProductCodes(page);

  // 상품 목록에서 추출 한 상품 코드로 상품 상세 정보 추출
  for (const productCode of productCodeList) {
    await getProductDetail(page, productCode);
  }

  // 브라우저 종료
  await browser.close();
}

// 로그인 함수
async function login(page) {
  // 로그인 페이지로 이동
  await page.goto(
    'https://ilovegohyang.go.kr/users/login.html?target=%2Fmain.html',
    // waitUntil : 페이지가 ''의 상태일 때 까지 기다림
    // networkidle2 : 네트워크 활동이 없을 때 까지 기다림
    { waitUntil: 'networkidle2' },
  );

  // 로그인
  await page.type('#id', 'hwt4oxh00v8'); // page.type : 입력
  await page.type('#pw', 'as49265504!'); // page.type : 입력
  const loginButton = await page.$x(
    '/html/body/div[1]/div/div[3]/section/div/form/div[2]/button',
  ); // 로그인 버튼의 xpath 위치
  if (loginButton.length > 0) {
    try {
      await Promise.all([
        await loginButton[0].click(), // 로그인 버튼 클릭
        await page.waitForNavigation({ waitUntil: 'networkidle2' }),
      ]);
      console.log('로그인 성공');
    } catch (err) {
      console.log('로그인 에러 : ', err);
    }
  }
}

// 상품 목록에서 상품 코드 추출
async function getProductCodes(page) {
  // 상품 목록 페이지로 이동
  // 추후 다음 버튼을 눌러서 다음 상품 목록을 가져오는 기능 추가 필요
  await page.goto('https://ilovegohyang.go.kr/goods/index-main.html', {
    waitUntil: 'networkidle2',
  }); // 상품 목록 페이지로 이동
  await page.waitForSelector('.item_img'); // .item_img가 로딩될 때 까지 대기

  try {
    const productCodeList = await page.$$eval(
      '.goods-list-items .item_img',
      (imgs) =>
        imgs.map((img) => {
          const match = img.getAttribute('src').match(/G(\d+)/); // G 뒤의 숫자들 가져오기
          return match ? match[1] : null;
        }),
    );

    console.log('상품 목록 추출 성공');
    return productCodeList;
  } catch (err) {
    console.error('상품 목록 추출 에러 : ', err);
  }
}

// 상품 상세 정보 추출
async function getProductDetail(page, productCode) {
  // 상품 상세 페이지로 이동
  await page.goto(
    `https://ilovegohyang.go.kr/items/details-main.html?code=G${productCode}`,
    { waitUntil: 'networkidle2' },
  );

  // $eval, $$eval : puppeteer의 메소드, 웹 페이지 내부의 DOM 요소에 접근함 / querySelector, querySelectorAll
  // 태그(id, class, a 등) 값으로 textContent, innerHTML 등 값 추출
  const thumbnailImages = await page.$$eval('.swiper_img img', (imgs) =>
    imgs.map((img) => img.src),
  ); // 썸네일 이미지
  const name = await page.$eval('.info_title h2 span', (name) =>
    name.textContent.trim(),
  ); // 상품명
  const description = await page.$eval('.info_title p span', (description) =>
    description.textContent.trim(),
  ); // 상품 설명
  const category = await page.$eval(
    '.ali_breadcrumb span:nth-last-child(2) a',
    (a) => (a.textContent.trim() ? a.textContent.trim() : null),
  ); // 카데고리
  const area = await page.$eval('.brand_mall', (area) =>
    area.textContent.trim(),
  ); // 지역
  const price = await page.$eval('.op_price, .price, .present_price', (price) =>
    price.textContent.trim().replace('P', ''),
  ); // 가격
  const origin = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('.shop_info'));
    for (const sapn of spans) {
      const title = sapn.querySelector('.title_col p');
      if (title && title.textContent.trim() === '원산지') {
        const originInfo = sapn.querySelector('.para_col .txt');
        return originInfo ? originInfo.textContent.trim() : null;
      }
    }
    return null;
  });
  const content = await page.$eval('.item_detail', (content) => [
    content.innerHTML,
  ]); // 본문 HTML

  // 상품 저장하기
  await axios
    .post('http://localhost:3000/goods/1', {
      code: Number(productCode),
      name,
      description,
      location: origin,
      category,
      point: Number(price.replace(',', '')),
      price: 0,
      thumbnail_image: thumbnailImages[0],
      productThumbnails: thumbnailImages.map((imageUrl) => ({
        image_url: imageUrl,
      })),
      productContents: content.map((content) => ({ content })),
    })
    .then((res) => {
      console.log('상품 저장 성공');
    })
    .catch((err) => {
      console.log(err);
    });
}

// 업데이트 로직도 필요함

scrapeProductCode('https://ilovegohyang.go.kr/goods/index-main.html');
