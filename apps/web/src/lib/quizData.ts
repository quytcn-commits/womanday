export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export const quizQuestions: QuizQuestion[] = [
  {
    id: 1,
    question: "Ngay Quoc te Phu nu 8/3 bat nguon tu su kien nao?",
    options: [
      "Cuoc bieu tinh cua nu cong nhan My nam 1857",
      "Hoi nghi Phu nu Quoc te 1910",
      "Ngay thanh lap Lien Hop Quoc",
      "Cuoc cach mang Phap 1789",
    ],
    correctIndex: 0,
    explanation: "Ngay 8/3/1857, nu cong nhan nganh det o New York bieu tinh doi quyen loi, tro thanh nguon goc cua ngay 8/3.",
  },
  {
    id: 2,
    question: "Hoa nao la bieu tuong pho bien nhat ngay 8/3?",
    options: ["Hoa huong duong", "Hoa hong", "Hoa tulip", "Hoa lan"],
    correctIndex: 1,
    explanation: "Hoa hong, dac biet mau do, la bieu tuong tinh yeu va su ton kinh danh cho phu nu.",
  },
  {
    id: 3,
    question: "Ai la nguoi de xuat ngay 8/3 la Ngay Quoc te Phu nu?",
    options: [
      "Clara Zetkin",
      "Marie Curie",
      "Rosa Luxemburg",
      "Eleanor Roosevelt",
    ],
    correctIndex: 0,
    explanation: "Clara Zetkin de xuat tai Hoi nghi Phu nu Quoc te nam 1910 o Copenhagen, Dan Mach.",
  },
  {
    id: 4,
    question: "Ngay Phu nu Viet Nam 20/10 ky niem su kien gi?",
    options: [
      "Thanh lap Hoi LHPN Viet Nam",
      "Ngay sinh Hai Ba Trung",
      "Cuoc khoi nghia Ba Trieu",
      "Thanh lap Dang CSVN",
    ],
    correctIndex: 0,
    explanation: "Ngay 20/10/1930, Hoi Lien hiep Phu nu Viet Nam duoc thanh lap.",
  },
  {
    id: 5,
    question: "Nu khoa hoc gia nao gianh 2 giai Nobel?",
    options: ["Rosalind Franklin", "Marie Curie", "Ada Lovelace", "Dorothy Hodgkin"],
    correctIndex: 1,
    explanation: "Marie Curie gianh Nobel Vat ly (1903) va Nobel Hoa hoc (1911).",
  },
  {
    id: 6,
    question: "Theo UNESCO, ty le nu sinh hoc dai hoc toan cau la bao nhieu?",
    options: ["35%", "45%", "50%", "55%"],
    correctIndex: 3,
    explanation: "Nu gioi chiem khoang 55% sinh vien dai hoc tren toan cau (UNESCO 2023).",
  },
  {
    id: 7,
    question: "Quoc gia nao dau tien cho phep phu nu bo phieu?",
    options: ["Anh", "My", "New Zealand", "Phap"],
    correctIndex: 2,
    explanation: "New Zealand la quoc gia dau tien cho phep phu nu bo phieu nam 1893.",
  },
  {
    id: 8,
    question: "Mau sac nao la bieu tuong cua phong trao nu quyen?",
    options: ["Do va vang", "Tim va trang", "Tim, trang va xanh la", "Hong va do"],
    correctIndex: 2,
    explanation: "Tim (pham gia), trang (thuan khiet) va xanh la (hy vong) la 3 mau cua phong trao Suffragette.",
  },
  {
    id: 9,
    question: "Nu phi hanh gia dau tien bay vao vu tru la ai?",
    options: ["Sally Ride", "Valentina Tereshkova", "Mae Jemison", "Peggy Whitson"],
    correctIndex: 1,
    explanation: "Valentina Tereshkova (Lien Xo) bay vao vu tru ngay 16/6/1963.",
  },
  {
    id: 10,
    question: "Theme ngay Quoc te Phu nu 2024 cua UN la gi?",
    options: [
      "Invest in Women",
      "DigitALL",
      "Gender Equality Today",
      "Break the Bias",
    ],
    correctIndex: 0,
    explanation: "UN Women chon chu de 'Invest in Women: Accelerate Progress' cho 8/3/2024.",
  },
];
