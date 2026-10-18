import { Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

type Language = 'en' | 'ar';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {

  currentLanguage = signal<Language>('ar');

  constructor(
    private translate: TranslateService
  ) {
    const savedLanguage = localStorage.getItem('language') as Language | null;

    const language: Language =
      savedLanguage === 'en' ? 'en' : 'ar';

    this.setLanguage(language);
  }

  setLanguage(language: Language): void {

    this.currentLanguage.set(language);

    this.translate.use(language);

    localStorage.setItem('language', language);

    document.documentElement.lang = language;

    document.documentElement.dir =
      language === 'ar' ? 'rtl' : 'ltr';
  }

  toggleLanguage(): void {

    const nextLanguage: Language =
      this.currentLanguage() === 'ar'
        ? 'en'
        : 'ar';

    this.setLanguage(nextLanguage);
  }

  isArabic(): boolean {
    return this.currentLanguage() === 'ar';
  }

  isEnglish(): boolean {
    return this.currentLanguage() === 'en';
  }
}