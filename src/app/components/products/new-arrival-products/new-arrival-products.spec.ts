import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewArrivalProducts } from './new-arrival-products';

describe('NewArrivalProducts', () => {
  let component: NewArrivalProducts;
  let fixture: ComponentFixture<NewArrivalProducts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewArrivalProducts]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewArrivalProducts);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
