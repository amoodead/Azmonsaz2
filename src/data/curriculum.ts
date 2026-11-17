import type { DifficultyLevel, GradeId, SubjectDefinition, SubjectId } from '../types/exam';

export const GRADES: Array<{ id: GradeId; label: string; shortLabel: string; subtitle: string }> = [
  { id: '7', label: 'پایه هفتم', shortLabel: 'هفتم', subtitle: 'سال اول متوسطه اول' },
  { id: '8', label: 'پایه هشتم', shortLabel: 'هشتم', subtitle: 'سال دوم متوسطه اول' },
  { id: '9', label: 'پایه نهم', shortLabel: 'نهم', subtitle: 'سال سوم متوسطه اول و آمادگی انتخاب رشته' },
];

export const DIFFICULTIES: Array<{ id: DifficultyLevel; label: string; description: string }> = [
  { id: 'easy', label: 'آسان و مروری', description: 'تسلط بر مفاهیم پایه کتاب درسی' },
  { id: 'standard', label: 'استاندارد امتحانی', description: 'مطابق سطح امتحانات مدرسه و نوبت' },
  { id: 'advanced', label: 'پیشرفته و چالشی', description: 'سوالات مفهومی و سطح تیزهوشان' },
];

export const SUBJECTS: SubjectDefinition[] = [
  {
    id: 'science',
    name: 'علوم تجربی',
    shortDesc: 'فیزیک، شیمی، زیست‌شناسی و زمین‌شناسی',
    lessonsByGrade: {
      '7': [
        { id: 'sci-7-1', number: 1, title: 'تجربه و تفکر', topics: 'روش علمی، مشاهده، فرضیه و آزمایش' },
        { id: 'sci-7-2', number: 2, title: 'اندازه‌گیری در علوم و ابزارهای آن', topics: 'جرم، حجم، چگالی و یکاهای استاندارد' },
        { id: 'sci-7-3', number: 3, title: 'اتم‌ها، الفبای مواد', topics: 'ساختار ماده، مولکول، عنصر و ترکیب' },
        { id: 'sci-7-4', number: 4, title: 'مواد پیرامون ما', topics: 'فلزها، نافلزها، آلیاژ و کاربرد مواد' },
        { id: 'sci-7-5', number: 5, title: 'از معدن تا خانه', topics: 'استخراج فلز آهن، اکسید آهن و سیمان' },
        { id: 'sci-7-6', number: 6, title: 'سفر آب در طبیعت', topics: 'چرخه آب، تبخیر، میعان، آب‌های زیرزمینی' },
        { id: 'sci-7-7', number: 7, title: 'سفر انرژی', topics: 'شکل‌های انرژی، تبدیل انرژی، قانون پایستگی' },
        { id: 'sci-7-8', number: 8, title: 'انرژی و نیازهای ما', topics: 'سوخت‌های فسیلی و انرژی‌های تجدیدپذیر' },
        { id: 'sci-7-9', number: 9, title: 'منابع انرژی', topics: 'انرژی خورشیدی، بادی، هسته‌ای و زمین‌گرمایی' },
        { id: 'sci-7-10', number: 10, title: 'گرما و بهینه‌سازی مصرف انرژی', topics: 'رسانش، همرفت، تابش و دماسنجی' },
        { id: 'sci-7-11', number: 11, title: 'یاخته و سازمان‌بندی آن', topics: 'سلول جانوری و گیاهی، اندامک‌ها و بافت' },
        { id: 'sci-7-12', number: 12, title: 'سفره سلامت', topics: 'کربوهیدرات، پروتئین، چربی، ویتامین و مواد معدنی' },
        { id: 'sci-7-13', number: 13, title: 'سفر غذا', topics: 'لوله گوارش، آنزیم‌ها، جذب و کبد' },
        { id: 'sci-7-14', number: 14, title: 'گردش مواد', topics: 'قلب، رگ‌ها، گلبول‌های خون و فشار خون' },
        { id: 'sci-7-15', number: 15, title: 'تبادل با محیط', topics: 'دستگاه تنفس، نایژک، کلیه‌ها و دفع' },
      ],
      '8': [
        { id: 'sci-8-1', number: 1, title: 'مخلوط و جداسازی مواد', topics: 'محلول، سوسپانسیون، انحلال‌پذیری و تقطیر' },
        { id: 'sci-8-2', number: 2, title: 'تغییرهای شیمیایی در خدمت زندگی', topics: 'تغییر فیزیکی و شیمیایی، مثلث آتش، آنزیم و کاتالیزگر' },
        { id: 'sci-8-3', number: 3, title: 'از درون اتم چه خبر؟', topics: 'الکترون، پروتون، نوترون، عدد اتمی، عدد جرمی، ایزوتوپ و یون' },
        { id: 'sci-8-4', number: 4, title: 'تنظیم عصبی', topics: 'مغز، نخاع، یاخته عصبی (نورون) و انعکاس' },
        { id: 'sci-8-5', number: 5, title: 'حس و حرکت', topics: 'ساختار چشم، گوش، استخوان‌ها و ماهیچه‌ها' },
        { id: 'sci-8-6', number: 6, title: 'تنظیم هورمونی', topics: 'غدد درون‌ریز، هیپوفیز، تیروئید، انسولین و آدرنالین' },
        { id: 'sci-8-7', number: 7, title: 'الفبای زیست‌فناوری', topics: 'DNA، کروموزوم، تقسیم میتوز و کاربرد زیست‌فناوری' },
        { id: 'sci-8-8', number: 8, title: 'تولیدمثل در جانداران', topics: 'تولیدمثل غیرجنسی و جنسی، گرده‌افشانی و لقاح' },
        { id: 'sci-8-9', number: 9, title: 'الکتریسیته', topics: 'بار الکتریکی، القا، جریان، ولتاژ و قانون اهم' },
        { id: 'sci-8-10', number: 10, title: 'مغناطیس', topics: 'قطب‌های آهنربا، میدان مغناطیسی و آهنربای الکتریکی' },
        { id: 'sci-8-11', number: 11, title: 'کانی‌ها', topics: 'ویژگی‌های کانی‌ها، سختی موهس و کاربرد کانی' },
        { id: 'sci-8-12', number: 12, title: 'سنگ‌ها', topics: 'سنگ‌های آذرین، رسوبی و دگرگونی، چرخه سنگ' },
        { id: 'sci-8-13', number: 13, title: 'هوازدگی', topics: 'هوازدگی فیزیکی و شیمیایی و تشکیل خاک' },
        { id: 'sci-8-14', number: 14, title: 'نور و ویژگی‌های آن', topics: 'بازتاب نور، آینه تخت، آینه مقعر و محدب' },
        { id: 'sci-8-15', number: 15, title: 'شکست نور', topics: 'عدسی همگرا و واگرا، منشور و طیف نور' },
      ],
      '9': [
        { id: 'sci-9-1', number: 1, title: 'مواد و نقش آن‌ها در زندگی', topics: 'ترکیب‌های یونی و مولکولی، نام‌گذاری و پیوندها' },
        { id: 'sci-9-2', number: 2, title: 'رفتار اتم‌ها با یکدیگر', topics: 'الکترون ظرفیتی، پیوند یونی و کووالانسی، واکنش شیمیایی' },
        { id: 'sci-9-3', number: 3, title: 'به دنبال محیطی بهتر برای زندگی', topics: 'چرخه کربن، نفت خام، پلاستیک‌ها و توسعه پایدار' },
        { id: 'sci-9-4', number: 4, title: 'حرکت چیست؟', topics: 'مسافت، جابه‌جایی، تندی، سرعت و شتاب' },
        { id: 'sci-9-5', number: 5, title: 'نیرو', topics: 'قانون اول، دوم و سوم نیوتن، وزن، اصطکاک' },
        { id: 'sci-9-6', number: 6, title: 'فشار و آثار آن', topics: 'فشار در جامدات، مایعات و گازها، اصل پاسکال' },
        { id: 'sci-9-7', number: 7, title: 'ماشین‌ها', topics: 'مزیت مکانیکی، اهرم‌ها، قرقره و سطح شیب‌دار' },
        { id: 'sci-9-8', number: 8, title: 'زمین ساخت ورقه‌ای', topics: 'ساختار درونی زمین، حرکت ورقه‌ها، زلزله و آتشفشان' },
        { id: 'sci-9-9', number: 9, title: 'آثاری از گذشته زمین', topics: 'فسیل‌ها، روش‌های فسیل‌شناسی و سن‌سنجی لایه‌ها' },
        { id: 'sci-9-10', number: 10, title: 'نگاهی به فضا', topics: 'منظومه شمسی، سیاره‌ها، ستارگان و کهکشان' },
        { id: 'sci-9-11', number: 11, title: 'گوناگونی جانداران', topics: 'طبقه‌بندی، باکتری‌ها، آغازیان، قارچ‌ها و ویروس‌ها' },
        { id: 'sci-9-12', number: 12, title: 'دنیای گیاهان', topics: 'گیاهان آوندی و بی‌آوند، نهان‌دانگان و بازدانگان' },
        { id: 'sci-9-13', number: 13, title: 'جانوران بی‌مهره', topics: 'اسفنج‌ها، کیسه‌تنان، کرم‌ها، بندپایان و نرم‌تنان' },
        { id: 'sci-9-14', number: 14, title: 'جانوران مهره‌دار', topics: 'ماهی‌ها، دوزیستان، خزندگان، پرندگان و پستانداران' },
        { id: 'sci-9-15', number: 15, title: 'با هم زیستن', topics: 'بوم‌سازگان، زنجیره غذایی، همزیستی و انگل' },
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
        { id: 'math-8-1', number: 1, title: 'عددهای اول و گویا', topics: 'مقایسه و عملیات چهارگانه روی اعداد گویا، کسرها' },
        { id: 'math-8-2', number: 2, title: 'عددهای اول و ب‌م‌م', topics: 'روش غربال، اعداد اول نسبت به هم و کاربرد ب‌م‌م' },
        { id: 'math-8-3', number: 3, title: 'چندضلعی‌ها و تقارن', topics: 'مجموع زاویه‌های داخلی و خارجی، چهارضلعی‌ها، تقارن محوری و مرکزی' },
        { id: 'math-8-4', number: 4, title: 'جبر و معادله', topics: 'معادله‌های کسری، ساده‌کردن عبارات جبری و مسئله‌های معادله‌ای' },
        { id: 'math-8-5', number: 5, title: 'بردار و مختصات', topics: 'مختصات بردار، جمع و ضرب عدد در بردار، طول بردار' },
        { id: 'math-8-6', number: 6, title: 'مثلث و قضیه فیثاغورس', topics: 'هم‌نهشتی مثلث‌های قائم‌الزاویه و قضیه فیثاغورس' },
        { id: 'math-8-7', number: 7, title: 'توان و جذر', topics: 'توان با پایه منفی، نماد علمی، قوانین توان و رادیکال' },
        { id: 'math-8-8', number: 8, title: 'آمار و احتمال', topics: 'میانگین، نمودار خط شکسته، فضای نمونه و محاسبه احتمال' },
        { id: 'math-8-9', number: 9, title: 'دایره و زاویه', topics: 'زاویه مرکزی و محیطی، وتر و کمان، مساحت قطاع' },
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
        { id: 'per-7-1', number: 1, title: 'زنگ آفرینش و چشمه معرفت', topics: 'معنی واژگان، نهاد و گزاره، کنایه و تشبیه' },
        { id: 'per-7-2', number: 2, title: 'نسل آینده‌ساز و علم و عمل', topics: 'انواع فعل، ماضی و مضارع، مفرد و جمع، قرابت معنایی' },
        { id: 'per-7-3', number: 3, title: 'آداب نیکان و قلب پرمهر', topics: 'صفت و موصوف، مضاف و مضاف‌الیه، آرایه تشخیص' },
        { id: 'per-7-4', number: 4, title: 'قصه و مثل و حکمت', topics: 'ساختار واژه، وندها (پیشوند و پسوند)، آرایه سجع و جناس' },
        { id: 'per-7-5', number: 5, title: 'ادبیات بومی و انقلاب', topics: 'مفعول و مسند، متمم و حرف اضافه، تحلیل شعر نو' },
      ],
      '8': [
        { id: 'per-8-1', number: 1, title: 'ستایش و پیش از این‌ها', topics: 'اجزای جمله، فعل اسنادی و ربطی، آرایه‌های ادبی' },
        { id: 'per-8-2', number: 2, title: 'خوب جهان را ببین و شوق خواندن', topics: 'گروه اسمی، هسته و وابسته‌ها، املای هم‌آواها' },
        { id: 'per-8-3', number: 3, title: 'ارمغان دانش و پرچم‌داران', topics: 'ساختمان فعل، ماضی نقلی و بعید، تشبیه و استعاره' },
        { id: 'per-8-4', number: 4, title: 'جوانمردی و آیین زیستن', topics: 'مفعول، متمم، منادا، ضرب‌المثل‌ها و کنایه' },
        { id: 'per-8-5', number: 5, title: 'ادبیات پایداری و اندیشه', topics: 'جمله ساده و مرکب، تلمیح و تضاد، درک مطلب ادبی' },
      ],
      '9': [
        { id: 'per-9-1', number: 1, title: 'ستایش و نام خدای', topics: 'مضاف و مضاف‌الیه، نقش‌های تبعی، آرایه مراعات نظیر' },
        { id: 'per-9-2', number: 2, title: 'فصل شکفتن و چشمه معرفت', topics: 'ساختمان واژه، واژه ساده، مرکب و مشتق، بن ماضی و مضارع' },
        { id: 'per-9-3', number: 3, title: 'آداب و اخلاق و سبک زندگی', topics: 'انواع جمله از نظر پیام، فعل معلوم و مجهول، تلمیح' },
        { id: 'per-9-4', number: 4, title: 'شعر حکمی، حماسی و عارفانه', topics: 'قالب‌های شعری (غزل، قصیده، مثنوی، رباعی)، وزن و قافیه' },
        { id: 'per-9-5', number: 5, title: 'نام‌آوران فرهنگ و ادبیات معاصر', topics: 'قرابت معنایی، آرایه‌های ایهام و اغراق، ویرایش و نگارش' },
      ],
    },
  },
  {
    id: 'arabic',
    name: 'عربی',
    shortDesc: 'ترجمه، قواعد صرف و نحو و درک متن',
    lessonsByGrade: {
      '7': [
        { id: 'arb-7-1', number: 1, title: 'درس اول تا سوم: آشنایی و ضمایر', topics: 'مذکر و مؤنث، هذا و هذه، ضمایر منفصل و اعداد' },
        { id: 'arb-7-2', number: 2, title: 'درس چهارم تا ششم: مثنی و جمع', topics: 'مثنی، جمع مذکر سالم، جمع مؤنث سالم و اولئک' },
        { id: 'arb-7-3', number: 3, title: 'درس هفتم تا نهم: فعل ماضی', topics: 'صرف فعل ماضی، ترجمه زمان گذشته و ضمایر متصل' },
        { id: 'arb-7-4', number: 4, title: 'درس دهم تا دوازدهم: جمله‌های کاربردی', topics: 'متضاد و مترادف، ساعت، روزهای هفته و درک متن' },
      ],
      '8': [
        { id: 'arb-8-1', number: 1, title: 'درس اول و دوم: مرور ماضی و آغاز مضارع', topics: 'صرف فعل مضارع (للغائب و للمخاطب) و حروف اتین' },
        { id: 'arb-8-2', number: 2, title: 'درس سوم و چهارم: مضارع متکلم و مستقبل', topics: 'سـ و سوف برای آینده، ضمایر متصل منصوبی و مجروری' },
        { id: 'arb-8-3', number: 3, title: 'درس پنجم و ششم: فعل امر و نهی', topics: 'ساخت فعل امر از مضارع، لا نهی و نفی' },
        { id: 'arb-8-4', number: 4, title: 'درس هفتم تا دهم: جمع مکسر و اعداد ترتیبی', topics: 'جمع مکسر، اعداد ۱ تا ۱۰۰، استفهام و ترجمه دقیق' },
      ],
      '9': [
        { id: 'arb-9-1', number: 1, title: 'درس اول و دوم: مرور زمان‌ها و جمله اسمیه', topics: 'مبتدا و خبر، جمله فعلیه و فاعل و مفعول' },
        { id: 'arb-9-2', number: 2, title: 'درس سوم و چهارم: فعل مجهول و مضی مستمر', topics: 'کان + مضارع، مجهول ماضی و مضارع و نایب فاعل' },
        { id: 'arb-9-3', number: 3, title: 'درس پنجم و ششم: اسم فاعل، مفعول و تفضیل', topics: 'اوزان اسم فاعل و اسم مفعول، صفت تفضیلی (افعل)' },
        { id: 'arb-9-4', number: 4, title: 'درس هفتم تا دهم: لا النافیه للجنس و نون وقایه', topics: 'اسلوب شرط، صفت و موصوف، مضاف و مضاف‌الیه' },
      ],
    },
  },
  {
    id: 'english',
    name: 'زبان انگلیسی',
    shortDesc: 'گرامر، واژگان، مکالمه و درک مطلب (Prospect)',
    lessonsByGrade: {
      '7': [
        { id: 'eng-7-1', number: 1, title: 'Lesson 1 & 2: My Name & My Classmates', topics: 'Greetings, alphabet, Subject Pronouns, Verb to be (am/is/are)' },
        { id: 'eng-7-2', number: 2, title: 'Lesson 3 & 4: My Age & My Family', topics: 'Numbers, Months, Family members, Possessive adjectives (my/your/his/her)' },
        { id: 'eng-7-3', number: 3, title: 'Lesson 5 & 6: My Appearance & My House', topics: 'Colors, Clothes, Rooms in a house, Present Continuous basics' },
        { id: 'eng-7-4', number: 4, title: 'Lesson 7 & 8: My Address & Favorite Food', topics: 'Telling time, Food vocabulary, Wh-questions (Where, What)' },
      ],
      '8': [
        { id: 'eng-8-1', number: 1, title: 'Lesson 1 & 2: My Nationality & My Week', topics: 'Countries & Nationalities, Days of the week, Simple Present (do/does)' },
        { id: 'eng-8-2', number: 2, title: 'Lesson 3 & 4: My Abilities & My Health', topics: 'Modal Can/Can’t, Health problems, Should/Shouldn’t, Body parts' },
        { id: 'eng-8-3', number: 3, title: 'Lesson 5 & 6: My City & My Village', topics: 'There is/There are, Places in town, Prepositions of place' },
        { id: 'eng-8-4', number: 4, title: 'Lesson 7: My Hobbies', topics: 'Free time activities, Like/Love + V-ing, Adverbs of frequency' },
      ],
      '9': [
        { id: 'eng-9-1', number: 1, title: 'Lesson 1 & 2: Personality & Travel', topics: 'Personality adjectives, Simple Present vs Present Continuous, Travel vocab' },
        { id: 'eng-9-2', number: 2, title: 'Lesson 3 & 4: Festivals & Services', topics: 'Simple Past (regular & irregular verbs), Was/Were, Public services' },
        { id: 'eng-9-3', number: 3, title: 'Lesson 5 & 6: Media & Health', topics: 'Past Continuous (was/were + V-ing), Future with Be going to & Will' },
      ],
    },
  },
  {
    id: 'social',
    name: 'مطالعات اجتماعی',
    shortDesc: 'مدنی، جغرافیا و تاریخ ایران و جهان',
    lessonsByGrade: {
      '7': [
        { id: 'soc-7-1', number: 1, title: 'بخش مدنی: حقوق، مسئولیت و قوانین', topics: 'همدلی، مسئولیت‌پذیری، قانون در مدرسه و جامعه، حوادث طبیعی' },
        { id: 'soc-7-2', number: 2, title: 'بخش جغرافیا: جمعیت و منابع ایران', topics: 'اقلیم و آب‌وهوای ایران، پراکندگی جمعیت، منابع آب و انرژی' },
        { id: 'soc-7-3', number: 3, title: 'بخش تاریخ: ایران باستان', topics: 'تمدن‌های باستانی، آریایی‌ها، هخامنشیان، اشکانیان و ساسانیان' },
      ],
      '8': [
        { id: 'soc-8-1', number: 1, title: 'بخش مدنی: تعاون، رسانه و اقتصاد خانواده', topics: 'آسیب‌های اجتماعی، سواد رسانه‌ای، مصرف درست و کارآفرینی' },
        { id: 'soc-8-2', number: 2, title: 'بخش جغرافیا: قاره آسیا و مناطق جهان', topics: 'ویژگی‌های جغرافیایی قاره آسیا، تنوع زیستی و زیست‌بوم‌ها' },
        { id: 'soc-8-3', number: 3, title: 'بخش تاریخ: ایران پس از اسلام تا صفویه', topics: 'ورود اسلام، سامانیان، سلجوقیان، حمله مغول و دوران صفویه' },
      ],
      '9': [
        { id: 'soc-9-1', number: 1, title: 'بخش جغرافیا: سیاره زمین و حرکت‌های آن', topics: 'مختصات جغرافیایی، طول و عرض جغرافیایی، قاره‌ها و اقیانوس‌ها' },
        { id: 'soc-9-2', number: 2, title: 'بخش مدنی: حکومت، قانون اساسی و جهان معاصر', topics: 'قوای سه‌گانه، حقوق شهروندی، سازمان‌های بین‌المللی' },
        { id: 'soc-9-3', number: 3, title: 'بخش تاریخ: تاریخ معاصر ایران و انقلاب اسلامی', topics: 'دوره قاجار، نهضت مشروطه، پهلوی، نهضت امام خمینی و دفاع مقدس' },
      ],
    },
  },
  {
    id: 'religion',
    name: 'پیام‌های آسمان',
    shortDesc: 'اعتقادات، احکام، اخلاق اسلامی و سیره',
    lessonsByGrade: {
      '7': [
        { id: 'rel-7-1', number: 1, title: 'بخش اول: خداشناسی و نشانه‌های الهی', topics: 'آفرینش هدفمند، شکرگزاری و یاد خدا' },
        { id: 'rel-7-2', number: 2, title: 'بخش دوم: نبوت، قرآن و امامت', topics: 'پیامبران الهی، معجزات، سیره پیامبر و امام علی(ع)' },
        { id: 'rel-7-3', number: 3, title: 'بخش سوم: احکام طهارت، وضو و نماز', topics: 'احکام تقلید، نجاسات و مطهرات، شرایط و ارکان نماز' },
      ],
      '8': [
        { id: 'rel-8-1', number: 1, title: 'بخش اول: معرفت پروردگار و معاد', topics: 'صفات الهی، عالم برزخ و رستاخیز، مسئولیت‌پذیری' },
        { id: 'rel-8-2', number: 2, title: 'بخش دوم: سیره ائمه و ولایت', topics: 'امام سجاد تا امام جواد(ع)، انتظار و زمینه‌سازی ظهور' },
        { id: 'rel-8-3', number: 3, title: 'بخش سوم: احکام روزه و اخلاق اجتماعی', topics: 'مبطلات روزه، نماز مسافر، حفظ اسرار و صداقت' },
      ],
      '9': [
        { id: 'rel-9-1', number: 1, title: 'بخش اول: توحید، عدل و سنت‌های الهی', topics: 'اختیار انسان، سنت آزمایش، توکل و شفاعت' },
        { id: 'rel-9-2', number: 2, title: 'بخش دوم: مرجعیت، ولایت فقیه و سیره ائمه', topics: 'امام هادی، عسکری و مهدی(عج)، تقلید و ولایت فقیه' },
        { id: 'rel-9-3', number: 3, title: 'بخش سوم: احکام بلوغ، خمس و امر به معروف', topics: 'مسائل شرعی نوجوانان، حق‌الناس، امر به معروف و نهی از منکر' },
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
