describe('Module', function () {

  //==============//
  // INITIALIZING //
  //==============//

  beforeEach(module('betsol.entityForm'));

  var EntityForm;
  beforeEach(inject(function (_EntityForm_) {
    EntityForm = _EntityForm_;
  }));


  //=========//
  // TESTING //
  //=========//

  it('service should be present', function () {
    expect(EntityForm).to.be.a('function');
  });

});
