import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WebsiteVisitService {

  private readonly http = inject(HttpClient);

  private readonly visitorIdKey = 'website_visitor_id';

  private getVisitorId(): string {
    let visitorId = localStorage.getItem(this.visitorIdKey);

    if (!visitorId) {
      visitorId = crypto.randomUUID();

      localStorage.setItem(
        this.visitorIdKey,
        visitorId
      );
    }

    return visitorId;
  }

  trackVisit(): void {
    const visitorId = this.getVisitorId();

    this.http.post(
      `${environment.apiBaseUrl}/WebsiteVisits`,
      {
        visitorId
      }
    ).subscribe({
      error: () => {
        // Tracking must never affect the website.
      }
    });
  }
}