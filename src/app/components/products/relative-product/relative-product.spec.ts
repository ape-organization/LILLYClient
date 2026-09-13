import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RelativeProduct } from './relative-product';

describe('RelativeProduct', () => {
  let component: RelativeProduct;
  let fixture: ComponentFixture<RelativeProduct>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RelativeProduct]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RelativeProduct);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
