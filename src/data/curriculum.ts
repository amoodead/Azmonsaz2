import type { DifficultyLevel, GradeId, SubjectDefinition, SubjectId } from '../types/exam';

export const GRADES: Array<{ id: GradeId; label: string; shortLabel: string; subtitle: string }> = [
  { id: '7', label: 'پایه هفتم', shortLabel: 'هفتم', subtitle: 'سال اول متوسطه اول' },
  { id: '8', label: 'پایه هشتم', shortLabel: 'هشتم', subtitle: 'سال دوم متوسطه اول' },
  { id: '9', label: 'پایه نهم', shortLabel: 'نهم', subtitle: 'سال سوم متوسطه اول و آمادگی انتخاب رشته' },
];

export const DIFFICULTIES: Array<{ id: DifficultyLevel; label: string; description: string }> = [
  { id: 'easy', label: 'آسان', description: 'کمی ساده‌تر از تمرین‌های کتاب درسی و مروری' },
  { id: 'standard', label: 'متوسط', description: 'دقیقاً در سطح کتاب درسی و امتحانات مدرسه' },
  { id: 'advanced', label: 'سخت', description: 'سطح آزمون‌ها و کتاب‌های تیزهوشان (سمپاد)' },
];

export const SUBJECTS: SubjectDefinition[] = [
  {
    id: 'science',
    name: 'علوم تجربی',
    shortDesc: 'فیزیک، شیمی، زیست‌شناسی و زمین‌شناسی',
    lessonsByGrade: {
      '7': [
        { id: 'sci-7-1', number: 1, title: 'تجربه و تفکر', topics: 'روش علمی، مشاهده، فرضیه، متغیر مستقل و وابسته، آزمایش کنترل‌شده' },
        { id: 'sci-7-2', number: 2, title: 'اندازه‌گیری در علوم و ابزارهای آن', topics: 'جرم، حجم، چگالی و محاسبات آن، استوانه مدرج، دقت اندازه‌گیری و یکاهای SI' },
        { id: 'sci-7-3', number: 3, title: 'اتم‌ها، الفبای مواد', topics: 'ساختار ماده، مولکول، عنصر و ترکیب، تغییر حالت‌های ماده و فاصله بین مولکول‌ها' },
        { id: 'sci-7-4', number: 4, title: 'مواد پیرامون ما', topics: 'فلزها، نافلزها، شبه‌فلزها، رسانایی، آلیاژ و کاربرد مواد' },
        { id: 'sci-7-5', number: 5, title: 'از معدن تا خانه', topics: 'استخراج فلز آهن در کوره بلند، سنگ معدن، کربن، اکسید آهن، بتن و سیمان' },
        { id: 'sci-7-6', number: 6, title: 'سفر آب در طبیعت', topics: 'چرخه آب، تبخیر، میعان، حوضه آبریز، آب‌خوان و آب‌های زیرزمینی' },
        { id: 'sci-7-7', number: 7, title: 'سفر انرژی', topics: 'شکل‌های انرژی، پتانسیل گرانشی و کشسانی، جنبشی، تبدیل انرژی، قانون پایستگی' },
        { id: 'sci-7-8', number: 8, title: 'انرژی و نیازهای ما', topics: 'سوخت‌های فسیلی، زغال‌سنگ، نفت خام، گاز طبیعی و انرژی‌های تجدیدپذیر' },
        { id: 'sci-7-9', number: 9, title: 'منابع انرژی', topics: 'انرژی خورشیدی، بادی، برق‌آبی، هسته‌ای، زیست‌توده و زمین‌گرمایی' },
        { id: 'sci-7-10', number: 10, title: 'گرما و بهینه‌سازی مصرف انرژی', topics: 'رسانش، همرفت، تابش، دماسنج الکلی و جیوه‌ای، عایق حرارتی و فلاسک' },
        { id: 'sci-7-11', number: 11, title: 'یاخته و سازمان‌بندی آن', topics: 'سلول جانوری و گیاهی، غشا، دیواره یاخته‌ای، کلروپلاست، میتوکندری و بافت' },
        { id: 'sci-7-12', number: 12, title: 'سفره سلامت', topics: 'کربوهیدرات، پروتئین، لیپید، ویتامین‌های محلول در آب و چربی، مواد معدنی' },
        { id: 'sci-7-13', number: 13, title: 'سفر غذا', topics: 'لوله گوارش، آنزیم‌های گوارشی، معده، روده باریک، پرزها، جذب و نقش کبد' },
        { id: 'sci-7-14', number: 14, title: 'گردش مواد', topics: 'قلب چهارحفره‌ای، سرخرگ و سیاهرگ، مویرگ، گلبول قرمز و سفید، فشار خون' },
        { id: 'sci-7-15', number: 15, title: 'تبادل با محیط', topics: 'دستگاه تنفس، نایژک، کیسه‌های هوایی، نفرون کلیه‌ها، اوره و دفع' },
      ],
      '8': [
        { id: 'sci-8-1', number: 1, title: 'مخلوط و جداسازی مواد', topics: 'محلول، سوسپانسیون، انحلال‌پذیری و اثر دما، کاغذ صافی، قیف جداکننده و تقطیر' },
        { id: 'sci-8-2', number: 2, title: 'تغییرهای شیمیایی در خدمت زندگی', topics: 'تغییر فیزیکی و شیمیایی، واکنش‌دهنده و فراورده، مثلث آتش، آنزیم و کاتالیزگر' },
        { id: 'sci-8-3', number: 3, title: 'از درون اتم چه خبر؟', topics: 'الکترون، پروتون، نوترون، عدد اتمی، عدد جرمی، ایزوتوپ‌های هیدروژن، یون مثبت و منفی و مدل بور' },
        { id: 'sci-8-4', number: 4, title: 'تنظیم عصبی', topics: 'مغز، مخچه، بصل‌النخاع، نخاع، یاخته عصبی (نورون)، سیناپس و انعکاس نخاعی' },
        { id: 'sci-8-5', number: 5, title: 'حس و حرکت', topics: 'ساختار چشم، عدسی و شبکیه، گوش میانی و حلزونی، مفصل‌ها، استخوان‌ها و ماهیچه‌ها' },
        { id: 'sci-8-6', number: 6, title: 'تنظیم هورمونی', topics: 'غدد درون‌ریز، هیپوفیز، تیروئید و ید، پانکراس و انسولین، آدرنالین و کلسیم' },
        { id: 'sci-8-7', number: 7, title: 'الفبای زیست‌فناوری', topics: 'DNA، ژن، کروموزوم، تقسیم میتوز و مراحل آن، مهندسی ژنتیک و زیست‌فناوری' },
        { id: 'sci-8-8', number: 8, title: 'تولیدمثل در جانداران', topics: 'تولیدمثل غیرجنسی (جوانه‌زدن، قطعه قطعه شدن، هاگ)، میوز، گرده‌افشانی و لقاح' },
        { id: 'sci-8-9', number: 9, title: 'الکتریسیته', topics: 'بار الکتریکی، القا و مالش، الکتروسکوپ، جریان الکتریکی، ولتاژ، مقاومت و قانون اهم' },
        { id: 'sci-8-10', number: 10, title: 'مغناطیس', topics: 'قطب‌های آهنربا، القای مغناطیسی، میدان مغناطیسی زمین، آهنربای الکتریکی و موتور ساده' },
        { id: 'sci-8-11', number: 11, title: 'کانی‌ها', topics: 'ویژگی‌های کانی‌ها، سختی موهس، جلا، رنگ خاکه، رخ و کاربرد کانی‌های صنعتی' },
        { id: 'sci-8-12', number: 12, title: 'سنگ‌ها', topics: 'سنگ‌های آذرین درونی و بیرونی، سنگ‌های رسوبی و فسیل، دگرگونی و چرخه سنگ' },
        { id: 'sci-8-13', number: 13, title: 'هوازدگی', topics: 'هوازدگی فیزیکی (یخ‌زدن آب، تغییرات دما) و شیمیایی، فرسایش و افق‌های خاک' },
        { id: 'sci-8-14', number: 14, title: 'نور و ویژگی‌های آن', topics: 'پرتو نور، سایه و نیم‌سایه، قانون بازتاب، آینه تخت، آینه مقعر و کانون، آینه محدب' },
        { id: 'sci-8-15', number: 15, title: 'شکست نور', topics: 'شکست نور در مرز دو محیط، عدسی همگرا و واگرا، نزدیک‌بینی و دوربینی، منشور و طیف نور' },
      ],
      '9': [
        { id: 'sci-9-1', number: 1, title: 'مواد و نقش آن‌ها در زندگی', topics: 'ترکیب‌های یونی و مولکولی، رسانایی محلول‌ها، پیوند یونی، نام‌گذاری و کاتیون/آنیون' },
        { id: 'sci-9-2', number: 2, title: 'رفتار اتم‌ها با یکدیگر', topics: 'الکترون ظرفیتی، قانون هشت‌تایی، پیوند کووالانسی یگانه تا سه‌گانه، موازنه و پایستگی جرم' },
        { id: 'sci-9-3', number: 3, title: 'به دنبال محیطی بهتر برای زندگی', topics: 'چرخه کربن، هیدروکربن‌ها، تقطیر جزءبه‌جزء نفت خام، بسپار (پلیمر) و پلاستیک‌ها' },
        { id: 'sci-9-4', number: 4, title: 'حرکت چیست؟', topics: 'مسافت، جابه‌جایی، تندی متوسط و لحظه‌ای، سرعت، شتاب متوسط و نمودار مکان-زمان' },
        { id: 'sci-9-5', number: 5, title: 'نیرو', topics: 'برآیند نیروها، قانون اول، دوم (F=ma) و سوم نیوتن، وزن، اصطکاک ایستایی و جنبشی' },
        { id: 'sci-9-6', number: 6, title: 'فشار و آثار آن', topics: 'فشار در جامدات (P=F/A)، فشار مایعات و عمق، اصل پاسکال، فشار هوا و لوله‌های هم‌سطح' },
        { id: 'sci-9-7', number: 7, title: 'ماشین‌ها', topics: 'کار مکانیکی، مزیت مکانیکی واقعی و آرمانی، اهرم نوع ۱ تا ۳، قرقره ثابت و متحرک و سطح شیب‌دار' },
        { id: 'sci-9-8', number: 8, title: 'زمین ساخت ورقه‌ای', topics: 'ساختار درونی زمین (گوشته، هسته، خمیرکره)، حرکت ورقه‌های واگرا، همگرا و لغزشی، زلزله و سونامی' },
        { id: 'sci-9-9', number: 9, title: 'آثاری از گذشته زمین', topics: 'شرایط تشکیل فسیل، فسیل راهنما، روش‌های فسیل‌شناسی، ترتیب لایه‌های رسوبی و سن‌سنجی' },
        { id: 'sci-9-10', number: 10, title: 'نگاهی به فضا', topics: 'منظومه شمسی، سیاره‌های سنگی و گازی، سیارک، شهاب‌سنگ، ستارگان، صورت فلکی و کهکشان' },
        { id: 'sci-9-11', number: 11, title: 'گوناگونی جانداران', topics: 'طبقه‌بندی جانداران، باکتری‌ها (پروکاریوت)، آغازیان، قارچ‌ها و ساختار ویروس‌ها' },
        { id: 'sci-9-12', number: 12, title: 'دنیای گیاهان', topics: 'گیاهان آوندی و بی‌آوند، نهان‌دانگان تک‌لپه و دولپه، بازدانگان و فتوسنتز' },
        { id: 'sci-9-13', number: 13, title: 'جانوران بی‌مهره', topics: 'اسفنج‌ها، کیسه‌تنان، کرم‌های پهن/لوله‌ای/حلقوی، بندپایان و نرم‌تنان و خارپوستان' },
        { id: 'sci-9-14', number: 14, title: 'جانوران مهره‌دار', topics: 'ماهی‌ها، دوزیستان، خزندگان، پرندگان و پستانداران، خون‌سرد و خون‌گرم و گردش خون' },
        { id: 'sci-9-15', number: 15, title: 'با هم زیستن', topics: 'بوم‌سازگان، زنجیره و شبکه غذایی، هرم انرژی، همزیستی، هم‌سفرگی و انگلی' },
      ],
    },
  },
  {
    id: 'math',
    name: 'ریاضی',
    shortDesc: 'جبر، هندسه، اعداد، معادله و آمار',
    lessonsByGrade: {
      '7': [
        { id: 'math-7-1', number: 1, title: 'راهبردهای حل مسئله', topics: 'رسم شکل، الگویابی، حذف حالت‌های نامطلوب' },
        { id: 'math-7-2', number: 2, title: 'عددهای صحیح', topics: 'جمع و تفریق، ضرب و تقسیم اعداد مثبت و منفی، قرینه' },
        { id: 'math-7-3', number: 3, title: 'جبر و معادله', topics: 'عبارت جبری، مقدار عددی، ساده‌سازی و حل معادله' },
        { id: 'math-7-4', number: 4, title: 'هندسه و استدلال', topics: 'روابط بین زاویه‌ها، هم‌نهشتی مثلث‌ها و خط‌های موازی' },
        { id: 'math-7-5', number: 5, title: 'شمارنده‌ها و اعداد اول', topics: 'عدد اول، ب‌م‌م و ک‌م‌م، تجزیه به عوامل اول' },
        { id: 'math-7-6', number: 6, title: 'سطح و حجم', topics: 'مساحت جانبی و کل منشور و استوانه، حجم احجام هندسی' },
        { id: 'math-7-7', number: 7, title: 'توان و جذر', topics: 'مفهوم توان، ضرب و تقسیم توان‌های هم‌پایه، جذر تقریبی' },
        { id: 'math-7-8', number: 8, title: 'بردار و مختصات', topics: 'جمع بردارها، دستگاه مختصات، انتقال و تقارن' },
        { id: 'math-7-9', number: 9, title: 'آمار و احتمال', topics: 'نمودار دایره‌ای و ستونی، پیشامد و احتمال ریاضی' },
      ],
      '8': [
        { id: 'math-8-1', number: 1, title: 'عددهای صحیح و گویا', topics: 'جمع و تفریق و ضرب و تقسیم عددهای گویا، معرفی و مقایسه عددهای گویا روی محور' },
        { id: 'math-8-2', number: 2, title: 'عددهای اول', topics: 'روش غربال، اعداد اول نسبت به هم، شمارنده‌های اول، ب‌م‌م و ک‌م‌م' },
        { id: 'math-8-3', number: 3, title: 'چندضلعی‌ها', topics: 'مجموع زاویه‌های داخلی و خارجی، چهارضلعی‌ها، تقارن محوری و مرکزی، خطوط موازی' },
        { id: 'math-8-4', number: 4, title: 'جبر و معادله', topics: 'ساده‌کردن عبارات جبری، مقدار عددی، معادله‌های کسری و مسئله‌های معادله‌ای' },
        { id: 'math-8-5', number: 5, title: 'بردار و مختصات', topics: 'مختصات بردار، جمع و تفریق بردارها، ضرب عدد در بردار و طول بردار' },
        { id: 'math-8-6', number: 6, title: 'مثلث', topics: 'هم‌نهشتی مثلث‌های قائم‌الزاویه، قضیه فیثاغورس و کاربردهای آن' },
        { id: 'math-8-7', number: 7, title: 'توان و جذر', topics: 'توان با پایه منفی، قوانین توان، نماد علمی، جذر و رادیکال' },
        { id: 'math-8-8', number: 8, title: 'آمار و احتمال', topics: 'دسته‌بندی داده‌ها، میانگین، نمودار، فضای نمونه و محاسبه احتمال' },
        { id: 'math-8-9', number: 9, title: 'دایره', topics: 'زاویه مرکزی و محیطی، وتر و کمان، محیط و مساحت قطاع دایره' },
      ],
      '9': [
        { id: 'math-9-1', number: 1, title: 'مجموعه‌ها', topics: 'مفهوم مجموعه، زیرمجموعه، اجتماع، اشتراک و تفاضل' },
        { id: 'math-9-2', number: 2, title: 'عددهای حقیقی', topics: 'اعداد گنگ، قدرمطلق، نمایش روی محور و تقریب' },
        { id: 'math-9-3', number: 3, title: 'استدلال و هندسه', topics: 'تشابه مثلث‌ها، قضیه تالس و استدلال هندسی' },
        { id: 'math-9-4', number: 4, title: 'توان و ریشه', topics: 'توان منفی، نماد علمی پیشرفته، ضرب و تقسیم رادیکال‌ها' },
        { id: 'math-9-5', number: 5, title: 'عبارت‌های جبری و اتحادها', topics: 'اتحاد مربع، مزدوج، جمله مشترک و تجزیه عبارات' },
        { id: 'math-9-6', number: 6, title: 'خط و معادله‌های خطی', topics: 'شیب خط، عرض از مبدأ، معادله خط و دستگاه دو معادله' },
        { id: 'math-9-7', number: 7, title: 'عبارت‌های گویا', topics: 'ساده‌سازی، ضرب، تقسیم و جمع کسرهای جبری' },
        { id: 'math-9-8', number: 8, title: 'حجم و مساحت', topics: 'مساحت و حجم کره، هرم و مخروط' },
      ],
    },
  },
  {
    id: 'persian',
    name: 'ادبیات فارسی',
    shortDesc: 'دستور زبان، آرایه‌های ادبی، املا و درک مطلب',
    lessonsByGrade: {
      '7': [
        { id: 'per-7-1', number: 1, title: 'زنگ آفرینش', topics: 'ستایش، معنی واژگان، نهاد و گزاره، جمله دو جزئی و سه جزئی' },
        { id: 'per-7-2', number: 2, title: 'چشمه معرفت', topics: 'آرایه تشبیه، واژگان، مترادف و متضاد، املای درست' },
        { id: 'per-7-3', number: 3, title: 'نسل آینده‌ساز', topics: 'انواع فعل، ماضی و مضارع، مفرد و جمع (سالم و مکسر)' },
        { id: 'per-7-4', number: 4, title: 'با بهار', topics: 'آرایه تشخیص و حس‌آمیزی، قرابت معنایی ابیات بهاری' },
        { id: 'per-7-5', number: 5, title: 'قلب پرمهر', topics: 'صفت و موصوف، مضاف و مضاف‌الیه، نقش‌های اسم' },
        { id: 'per-7-6', number: 6, title: 'علم و عمل', topics: 'پند و حکمت ادبی، قرابت معنایی دانش و عمل' },
        { id: 'per-7-7', number: 7, title: 'قصه و مثل', topics: 'ضرب‌المثل‌ها، آرایه کنایه و درک داستان‌های تعلیمی' },
        { id: 'per-7-8', number: 8, title: 'پند پدر', topics: 'ساختار واژه، وندها (پیشوند و پسوند)، آرایه سجع و جناس' },
        { id: 'per-7-9', number: 9, title: 'آداب نیکان', topics: 'مفعول و نشانه را، متمم و حرف اضافه، مسند' },
        { id: 'per-7-10', number: 10, title: 'ادبیات بومی و انقلاب', topics: 'تحلیل شعر نو و سپید، درک مطلب و نگارش ادبی' },
      ],
      '8': [
        { id: 'per-8-1', number: 1, title: 'پیش از این‌ها', topics: 'ستایش، اجزای جمله، فعل اسنادی و ربطی، مسند' },
        { id: 'per-8-2', number: 2, title: 'خوب جهان را ببین', topics: 'گروه اسمی، هسته و وابسته‌های پیشین و پسین' },
        { id: 'per-8-3', number: 3, title: 'ارمغان دانش', topics: 'املای هم‌آواها، معنی لغات و درک مطلب' },
        { id: 'per-8-4', number: 4, title: 'سفر شکفتن', topics: 'ساختمان فعل، ماضی نقلی، ماضی بعید و التزامی' },
        { id: 'per-8-5', number: 5, title: 'شوق خواندن', topics: 'مفعول، متمم، منادا و نقش‌های دستوری در جمله' },
        { id: 'per-8-6', number: 6, title: 'راه نیک‌بختی', topics: 'آرایه تشبیه و استعاره، قرابت معنایی' },
        { id: 'per-8-7', number: 7, title: 'جوانمردی و آیین زیستن', topics: 'ضرب‌المثل‌ها، آرایه کنایه و آیین فتوت' },
        { id: 'per-8-8', number: 8, title: 'پرچم‌داران', topics: 'جمله ساده و مرکب، آرایه تلمیح و واژگان حماسی' },
        { id: 'per-8-9', number: 9, title: 'ادبیات پایداری و اندیشه', topics: 'آرایه تضاد و مراعات نظیر، تحلیل شعر و نثر معاصر' },
      ],
      '9': [
        { id: 'per-9-1', number: 1, title: 'ستایش و نام خدای', topics: 'مضاف و مضاف‌الیه، نقش‌های تبعی (معطوف، بدل، تکرار)' },
        { id: 'per-9-2', number: 2, title: 'چشمه معرفت', topics: 'آرایه مراعات نظیر، تشبیه و تشخیص، معنی واژگان' },
        { id: 'per-9-3', number: 3, title: 'فصل شکفتن', topics: 'ساختمان واژه (ساده، مرکب، مشتق، مشتق-مرکب)، بن ماضی و مضارع' },
        { id: 'per-9-4', number: 4, title: 'آداب و اخلاق', topics: 'اجزای جمله، فعل معلوم و مجهول، جملات سه جزئی و چهار جزئی' },
        { id: 'per-9-5', number: 5, title: 'سبک زندگی', topics: 'انواع جمله از نظر پیام (خبری، پرسشی، عاطفی، امری) و قرابت معنایی' },
        { id: 'per-9-6', number: 6, title: 'شعر حکمی و حماسی', topics: 'آرایه تلمیح، اغراق و تضاد، شناخت متون حماسی و شاهنامه' },
        { id: 'per-9-7', number: 7, title: 'قالب‌های شعری', topics: 'غزل، قصیده، مثنوی، رباعی، قطعه، وزن و قافیه و ردیف' },
        { id: 'per-9-8', number: 8, title: 'شعر عارفانه', topics: 'آرایه ایهام و کنایه، تحلیل ابیات حافظ و سعدی و مولانا' },
        { id: 'per-9-9', number: 9, title: 'نام‌آوران فرهنگ و ادبیات معاصر', topics: 'املا، ویرایش و نگارش، واژگان و شعر معاصر' },
      ],
    },
  },
  {
    id: 'arabic',
    name: 'عربی',
    shortDesc: 'ترجمه، قواعد صرف و نحو و درک متن',
    lessonsByGrade: {
      '7': [
        { id: 'arb-7-1', number: 1, title: 'شناخت واژگان و اسم اشاره نزدیک', topics: 'هذا و هذه، مذکر و مؤنث حقیقی و لفظی، ترجمه جملات ساده' },
        { id: 'arb-7-2', number: 2, title: 'اسم اشاره دور و پرسش‌ها', topics: 'ذلک و تلک، ادوات استفهام (من، ما، این، هل) و واژگان درس ۲' },
        { id: 'arb-7-3', number: 3, title: 'مثنی و جمع سالم', topics: 'مثنی (-انِ/-ینِ)، جمع مذکر سالم (-ونَ/-ینَ)، جمع مؤنث سالم (-ات) و هؤلاء' },
        { id: 'arb-7-4', number: 4, title: 'ضمایر منفصل و معرفی اشخاص', topics: 'ضمایر منفصل فاعلی (أنا، نَحنُ، أنتَ، أنتِ، هُوَ، هِیَ) و ترجمه' },
        { id: 'arb-7-5', number: 5, title: 'فعل ماضی (مفرد و غایب)', topics: 'ساخت و صرف فعل ماضی برای مفرد غایب و مخاطب، ترجمه زمان گذشته' },
        { id: 'arb-7-6', number: 6, title: 'فعل ماضی (کامل و ضمایر متصل)', topics: 'صرف ۱۴ صیغه ماضی، ضمایر متصل و مطابقت فعل و فاعل' },
        { id: 'arb-7-7', number: 7, title: 'اعداد و روزهای هفته', topics: 'اعداد ۱ تا ۱۲، ایام هفته، مترادف و متضاد واژگان' },
        { id: 'arb-7-8', number: 8, title: 'ساعت، فصل‌ها و درک متن', topics: 'خواندن ساعت به عربی، حروف جر و ترجمه متن‌های کاربردی' },
      ],
      '8': [
        { id: 'arb-8-1', number: 1, title: 'مرور ماضی و جمله فعلیه', topics: 'مرور صرف فعل ماضی، ترجمه جملات گذشته و واژگان آغازین هشتم' },
        { id: 'arb-8-2', number: 2, title: 'فعل مضارع (غایب و مخاطب)', topics: 'حروف مضارعه (أتین)، صرف مضارع برای مفرد، مثنی و جمع غایب و مخاطب' },
        { id: 'arb-8-3', number: 3, title: 'فعل مضارع (متکلم) و زمان آینده', topics: 'صیغه‌های متکلم وحده و مع‌الغیر، سـ و سوف برای مستقبل و لا نفی' },
        { id: 'arb-8-4', number: 4, title: 'ضمایر متصل منصوبی و مجروری', topics: 'ترکیب اسم + ضمیر، فعل + ضمیر مفعولی (ـه، ـها، ـک، ـنی)' },
        { id: 'arb-8-5', number: 5, title: 'فعل امر', topics: 'روش ساخت فعل امر از مضارع مخاطب، همزه امر و کاربردهای آن' },
        { id: 'arb-8-6', number: 6, title: 'فعل نهی', topics: 'ساخت نهی با لا نهی، تفاوت لا نفی و لا نهی در معنی و اعراب آخر فعل' },
        { id: 'arb-8-7', number: 7, title: 'جمع مکسر و اعداد ترتیبی', topics: 'جمع‌های مکسر پرکاربرد، اعداد ۱ تا ۱۰۰ و اعداد ترتیبی' },
        { id: 'arb-8-8', number: 8, title: 'استفهام و ترجمه پیشرفته', topics: 'کَم، کَیْفَ، مَتی، لِماذا و تحلیل متن‌های کتاب هشتم' },
      ],
      '9': [
        { id: 'arb-9-1', number: 1, title: 'مرور زمان‌ها و جمله اسمیه', topics: 'مبتدا و خبر، جمله اسمیه و جمله فعلیه، فاعل و مفعول' },
        { id: 'arb-9-2', number: 2, title: 'ماضی استمراری و ماضی بعید', topics: 'کانَ + فعل مضارع (ماضی استمراری) و کانَ + فعل ماضی (ماضی بعید)' },
        { id: 'arb-9-3', number: 3, title: 'فعل مجهول و نایب فاعل', topics: 'مجهول‌سازی ماضی (فُعِلَ) و مضارع (یُفْعَلُ)، تشخیص نایب فاعل' },
        { id: 'arb-9-4', number: 4, title: 'اسم فاعل و اسم مفعول', topics: 'اوزان فاعِل و مَفعول در ثلاثی مجرد و مُـ... در مزید' },
        { id: 'arb-9-5', number: 5, title: 'صفت تفضیلی و برترین', topics: 'وزن أفعَل، مقایسه با مِن و اضافه به جمع برای صفت برترین' },
        { id: 'arb-9-6', number: 6, title: 'اسلوب شرط و لا النافیه للجنس', topics: 'ادوات شرط (إن، مَن، ما)، فعل شرط و جواب شرط، لا النافیه للجنس' },
        { id: 'arb-9-7', number: 7, title: 'صفت و موصوف و اضافه', topics: 'تطابق صفت و موصوف در ۴ ویژگی، مضاف و مضاف‌الیه و نون وقایه' },
      ],
    },
  },
  {
    id: 'english',
    name: 'زبان انگلیسی',
    shortDesc: 'گرامر، واژگان، مکالمه و درک مطلب (Prospect)',
    lessonsByGrade: {
      '7': [
        { id: 'eng-7-1', number: 1, title: 'Lesson 1: My Name', topics: 'Greetings (سلام و احوال‌پرسی), alphabet, Subject Pronouns (I, you, he, she), am/is/are' },
        { id: 'eng-7-2', number: 2, title: 'Lesson 2: My Classmates', topics: 'Introducing classmates, Verb to be (questions & negatives), classroom objects' },
        { id: 'eng-7-3', number: 3, title: 'Lesson 3: My Age', topics: 'Numbers 1-100, Months of the year, How old are you?, Birthdays' },
        { id: 'eng-7-4', number: 4, title: 'Lesson 4: My Family', topics: 'Family members, Jobs, Possessive adjectives (my, your, his, her, their)' },
        { id: 'eng-7-5', number: 5, title: 'Lesson 5: My Appearance', topics: 'Colors, Clothes, Describing people (tall, short, hair, eyes), What is he wearing?' },
        { id: 'eng-7-6', number: 6, title: 'Lesson 6: My House', topics: 'Rooms in a house, Furniture, Present Continuous (am/is/are + V-ing)' },
        { id: 'eng-7-7', number: 7, title: 'Lesson 7: My Address', topics: 'Telling time, Phone numbers, Addresses, Where do you live?' },
        { id: 'eng-7-8', number: 8, title: 'Lesson 8: My Favorite Food', topics: 'Food & drinks vocabulary, Hungry/Thirsty, Wh-questions (What/Where/Who)' },
      ],
      '8': [
        { id: 'eng-8-1', number: 1, title: 'Lesson 1: My Nationality', topics: 'Countries & Nationalities, Where are you from?, Speak/Live in Simple Present' },
        { id: 'eng-8-2', number: 2, title: 'Lesson 2: My Week', topics: 'Days of the week, School subjects, Daily routines, Simple Present (do/does)' },
        { id: 'eng-8-3', number: 3, title: 'Lesson 3: My Abilities', topics: 'Modal Can / Can’t, Skills & talents, Questions with Can' },
        { id: 'eng-8-4', number: 4, title: 'Lesson 4: My Health', topics: 'Health problems (headache, toothache, fever), Should / Shouldn’t, Body parts' },
        { id: 'eng-8-5', number: 5, title: 'Lesson 5: My City', topics: 'Places in town, Asking for and giving directions, Prepositions of place' },
        { id: 'eng-8-6', number: 6, title: 'Lesson 6: My Village', topics: 'There is / There are, Rural life vocabulary, Nature & farm animals' },
        { id: 'eng-8-7', number: 7, title: 'Lesson 7: My Hobbies', topics: 'Free time activities, Like / Love / Enjoy + V-ing, Adverbs of frequency' },
      ],
      '9': [
        { id: 'eng-9-1', number: 1, title: 'Lesson 1: Personality', topics: 'Personality adjectives (helpful, hard-working, shy, kind), Simple Present vs Present Continuous' },
        { id: 'eng-9-2', number: 2, title: 'Lesson 2: Travel', topics: 'Travel & tourism vocabulary, Booking tickets/hotel, Simple Present & Future plans' },
        { id: 'eng-9-3', number: 3, title: 'Lesson 3: Festivals & Ceremonies', topics: 'Simple Past (regular & irregular verbs), Was/Were, Cultural ceremonies' },
        { id: 'eng-9-4', number: 4, title: 'Lesson 4: Services', topics: 'Public services (firefighter, ambulance, post office), Past Tense questions & negatives' },
        { id: 'eng-9-5', number: 5, title: 'Lesson 5: Media', topics: 'Media & news vocabulary, Past Continuous (was/were + V-ing), While / When' },
        { id: 'eng-9-6', number: 6, title: 'Lesson 6: Health & Injuries', topics: 'Accidents & first aid, Future tense with Be going to & Will, Giving advice' },
      ],
    },
  },
  {
    id: 'social',
    name: 'مطالعات اجتماعی',
    shortDesc: 'مدنی، جغرافیا و تاریخ ایران و جهان',
    lessonsByGrade: {
      '7': [
        { id: 'soc-7-1', number: 1, title: 'همدلی و حقوق من (مدنی)', topics: 'همدلی با دیگران، حقوق و مسئولیت‌ها در خانواده و مدرسه' },
        { id: 'soc-7-2', number: 2, title: 'قانون و ایمنی (مدنی)', topics: 'اهمیت قانون، قوانین راهنمایی و حوادث طبیعی (زلزله و سیل)' },
        { id: 'soc-7-3', number: 3, title: 'تولید و مصرف و میراث فرهنگی (مدنی)', topics: 'تولید ملی، مصرف درست، حفاظت از میراث فرهنگی' },
        { id: 'soc-7-4', number: 4, title: 'ناهمواری‌ها و آب‌وهوای ایران (جغرافیا)', topics: 'رشته‌کوه‌ها، جلگه‌ها، اقلیم و تنوع آب‌وهوایی ایران' },
        { id: 'soc-7-5', number: 5, title: 'جمعیت و منابع ایران (جغرافیا)', topics: 'پراکندگی جمعیت ایران، منابع آب، نفت، گاز و انرژی' },
        { id: 'soc-7-6', number: 6, title: 'آریایی‌ها و تمدن‌های کهن (تاریخ)', topics: 'تمدن ایلام و جیرفت، ورود آریایی‌ها، مادها و هخامنشیان' },
        { id: 'soc-7-7', number: 7, title: 'اشکانیان و ساسانیان (تاریخ)', topics: 'حکومت اشکانیان و ساسانیان، فرهنگ و تمدن ایران باستان' },
      ],
      '8': [
        { id: 'soc-8-1', number: 1, title: 'تعاون، همدلی و آسیب‌های اجتماعی (مدنی)', topics: 'تعاون در جامعه، پیشگیری از آسیب‌های اجتماعی و دوستی سالم' },
        { id: 'soc-8-2', number: 2, title: 'سواد رسانه‌ای و اقتصاد خانواده (مدنی)', topics: 'مدیریت رسانه، بودجه‌بندی، پس‌انداز و کارآفرینی' },
        { id: 'soc-8-3', number: 3, title: 'جغرافیای قاره آسیا (جغرافیا)', topics: 'موقعیت، ناهمواری‌ها، آب‌وهوا و جمعیت قاره آسیا' },
        { id: 'soc-8-4', number: 4, title: 'زیست‌بوم‌های جهان (جغرافیا)', topics: 'بیوم‌های جنگلی، بیابانی، علفزار و تندرا و حفاظت از محیط‌زیست' },
        { id: 'soc-8-5', number: 5, title: 'ورود اسلام به ایران و سامانیان (تاریخ)', topics: 'ظهور اسلام، ورود اسلام به ایران، طاهریان، صفاریان و سامانیان' },
        { id: 'soc-8-6', number: 6, title: 'سلجوقیان، خوارزمشاهیان و حمله مغول (تاریخ)', topics: 'دوران سلجوقی، خواجه نظام‌الملک، حمله مغول و ایلخانان' },
        { id: 'soc-8-7', number: 7, title: 'دوران صفویه (تاریخ)', topics: 'تأسیس حکومت صفویه، شاه عباس، اصفهان و شکوفایی هنر و معماری' },
      ],
      '9': [
        { id: 'soc-9-1', number: 1, title: 'سیاره زمین و حرکت‌های آن (جغرافیا)', topics: 'حرکت وضعی و انتقالی زمین، پیدایش شب و روز و فصل‌ها' },
        { id: 'soc-9-2', number: 2, title: 'مختصات جغرافیایی و قاره‌ها (جغرافیا)', topics: 'طول و عرض جغرافیایی، محاسبه ساعت مناطق، قاره‌ها و اقیانوس‌ها' },
        { id: 'soc-9-3', number: 3, title: 'حکومت، قانون اساسی و قوا (مدنی)', topics: 'جمهوری اسلامی، قانون اساسی، قوای مجریه، مقننه و قضائیه' },
        { id: 'soc-9-4', number: 4, title: 'حقوق شهروندی و سازمان‌های بین‌المللی (مدنی)', topics: 'حقوق و وظایف شهروندان، سازمان ملل و نهادهای جهانی' },
        { id: 'soc-9-5', number: 5, title: 'دوره قاجار و نهضت مشروطه (تاریخ)', topics: 'استعمار، قراردادهای دوره قاجار، جنبش تنباکو و انقلاب مشروطه' },
        { id: 'soc-9-6', number: 6, title: 'دوره پهلوی و نهضت امام خمینی (تاریخ)', topics: 'حکومت رضاخان و محمدرضا پهلوی، ۱۵ خرداد و شکل‌گیری نهضت' },
        { id: 'soc-9-7', number: 7, title: 'انقلاب اسلامی و دفاع مقدس (تاریخ)', topics: 'پیروزی انقلاب ۱۳۵۷، هشت سال دفاع مقدس و دستاوردهای آن' },
      ],
    },
  },
  {
    id: 'religion',
    name: 'پیام‌های آسمان',
    shortDesc: 'اعتقادات، احکام، اخلاق اسلامی و سیره',
    lessonsByGrade: {
      '7': [
        { id: 'rel-7-1', number: 1, title: 'زیباترین نقاش و آفرینش هدفمند', topics: 'خداشناسی، نظم در آفرینش، نشانه‌های الهی و شکرگزاری' },
        { id: 'rel-7-2', number: 2, title: 'استعانت از خدا و یاد پروردگار', topics: 'آیه ایاک نعبد و ایاک نستعین، توکل و آرامش قلبی' },
        { id: 'rel-7-3', number: 3, title: 'پیامبران الهی و نبوت', topics: 'فلسفه بعثت پیامبران، معجزه و پیامبران اولوالعزم' },
        { id: 'rel-7-4', number: 4, title: 'سیره پیامبر(ص) و امام علی(ع)', topics: 'اخلاق پیامبر اسلام، ولایت امام علی(ع) و غدیر خم' },
        { id: 'rel-7-5', number: 5, title: 'احکام تقلید و طهارت', topics: 'تقلید و مجتهد، نجاسات دهگانه و مطهرات' },
        { id: 'rel-7-6', number: 6, title: 'احکام وضو و تیمم', topics: 'مقدمات، شرایط، واجبات و مبطلات وضو، شرایط تیمم' },
        { id: 'rel-7-7', number: 7, title: 'احکام و اسرار نماز', topics: 'مقدمات نماز، ارکان و غیرارکان نماز، نماز جماعت' },
        { id: 'rel-7-8', number: 8, title: 'اخلاق فردی و دوستی', topics: 'ادب و احترام، انتخاب دوست خوب، راستگویی' },
      ],
      '8': [
        { id: 'rel-8-1', number: 1, title: 'معرفت پروردگار و صفات الهی', topics: 'صفات جمال و جلال خداوند، حکمت و علم الهی' },
        { id: 'rel-8-2', number: 2, title: 'مرگ، عالم برزخ و معاد', topics: 'حقیقت مرگ، عالم برزخ، رستاخیز و نامه اعمال' },
        { id: 'rel-8-3', number: 3, title: 'سیره امام سجاد تا امام باقر(ع)', topics: 'صحیفه سجادیه، نهضت علمی امام باقر و امام صادق(ع)' },
        { id: 'rel-8-4', number: 4, title: 'سیره امام کاظم تا امام جواد(ع)', topics: 'ایستادگی در برابر ظلم، ولایتعهدی امام رضا(ع) و علم امام جواد(ع)' },
        { id: 'rel-8-5', number: 5, title: 'فرهنگ انتظار و مهدویت', topics: 'وظایف منتظران، زمینه‌سازی ظهور و امید به آینده' },
        { id: 'rel-8-6', number: 6, title: 'احکام روزه', topics: 'شرایط وجوب روزه، نیت، مبطلات روزه و روزه قضا و کفاره' },
        { id: 'rel-8-7', number: 7, title: 'احکام نماز مسافر', topics: 'شرط مسافت شرعی (۸ فرسخ)، قصر و تمام در نماز مسافر' },
        { id: 'rel-8-8', number: 8, title: 'اخلاق اجتماعی و حفظ اسرار', topics: 'رازداری، دوری از غیبت و تهمت، صداقت و امانت‌داری' },
      ],
      '9': [
        { id: 'rel-9-1', number: 1, title: 'توحید، عدل و اختیار انسان', topics: 'توحید عملی، عدل الهی، اختیار و مسئولیت انسان در انتخاب مسیر' },
        { id: 'rel-9-2', number: 2, title: 'سنت‌های الهی و شفاعت', topics: 'سنت آزمایش الهی، توکل، دعا و معنای صحیح شفاعت' },
        { id: 'rel-9-3', number: 3, title: 'سیره امام هادی و امام عسکری(ع)', topics: 'حفظ وحدت امت، سازمان وکالت، زیارت جامعه کبیره' },
        { id: 'rel-9-4', number: 4, title: 'امام مهدی(عج) و فلسفه غیبت', topics: 'غیبت صغری و کبری، نواب خاص، وظایف در عصر غیبت' },
        { id: 'rel-9-5', number: 5, title: 'مرجعیت و ولایت فقیه', topics: 'تقلید در عصر غیبت، شرایط مرجع تقلید و جایگاه ولایت فقیه' },
        { id: 'rel-9-6', number: 6, title: 'احکام بلوغ، خمس و حق‌الناس', topics: 'تکالیف شرعی نوجوانان، موارد خمس، اهمیت ادای حق‌الناس' },
        { id: 'rel-9-7', number: 7, title: 'امر به معروف و نهی از منکر', topics: 'شرایط و مراحل امر به معروف و نهی از منکر، اخلاق اجتماعی' },
      ],
    },
  },
];

export function getSubjectById(id: SubjectId): SubjectDefinition {
  return SUBJECTS.find((s) => s.id === id) ?? SUBJECTS[0];
}

export function getGradeLabel(grade: GradeId): string {
  return GRADES.find((g) => g.id === grade)?.label ?? 'پایه هشتم';
}

export function getDifficultyLabel(difficulty: DifficultyLevel): string {
  return DIFFICULTIES.find((d) => d.id === difficulty)?.label ?? 'استاندارد امتحانی';
}

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);
}

export function formatDurationPersian(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return `${toPersianDigits(mm)}:${toPersianDigits(ss)}`;
}

export const OPTION_LETTERS = ['الف', 'ب', 'ج', 'د'] as const;
